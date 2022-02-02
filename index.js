/**
 * Vue2 webpack下使用
 * 在webpack的客户端包中如果要引入pages.js的相关依赖（pages.js文件本身不能被webpack的客户端包依赖）
 * 可以在pages.js中使用global引入uni-pages-hot-modules
 * 比如 global.hotRequire = require('uni-pages-hot-modules')
 * 这样pages.js的相关依赖中就不需要再定义hotRequire
 * 在vue.config.js中使用DefinePlugin将hotRequire和hotRequire.context分别替换成require和require.context
 * 在uni-app的应用中就可以引入pages.js的相关依赖模块了。比如可以直接用于uni-simple-router
 * 并且可以做到客户端包和本地配置包的双向热重载
 *
 * Vue3 vite下使用
 * 在pages.json中使用条件编译直接 #exec hotJs('./111.js')
 */

// 判断是否vue3和vite
let Vue3 = false
let getPreVueContext
let handleHotUpdate
const uniVue3HotPathList = new Set()
const uniVue3HotDictList = new Set()
let oldH5HotUpdate
let h5Server
try {
    getPreVueContext = require('@dcloudio/uni-cli-shared/dist/preprocess/context').getPreVueContext()
    if (getPreVueContext.VUE3) {
        Vue3 = true
    }
    // 为vite版的uni-h5单独处理
    handleHotUpdate = require('@dcloudio/uni-h5-vite/dist/plugin/handleHotUpdate')
    oldH5HotUpdate = handleHotUpdate.createHandleHotUpdate()

    // 这里骚操作一下，重写createHandleHotUpdate，拦截入参的file属性，强行加上.pages.json的后缀
    // 因为uni vite本身判断是pagesJson的变更是通过endsWith，因此这里可以抓个漏洞，让uni误以为是pagesJson变更了
    handleHotUpdate.createHandleHotUpdate = function () {
        return async function (obj) {
            h5Server = obj.server
            const newParams = {...obj}
            if (uniVue3HotPathList.has(obj.file) || uniVue3HotPathList.has(obj.file.replace(/\//g, '\\'))) {
                // newParams.file = obj.file + '.pages.json'
                newParams.file = 'pages.json'
            }
            return await oldH5HotUpdate.call(this, newParams)
        }
    }
} catch (e) {}

const chokidar = require('chokidar')
const tmp = require('tmp')
const path = require('path')
const callsites = require('callsites')
const fs = require('fs')
const Module = require('module').Module
const deepFind = require('./deepFind')
const oldLoad = Module._load
const wrap = Module.wrap
let addDependency
let tmpfile = tmp.fileSync();
uniVue3HotPathList.add(tmpfile.name)

function touchTmpFileChange () {
    let now = new Date();
    fs.utimes(tmpfile.name, now, now, error => {
        if (error) console.error(error);
    });
}

/**
 * CommonJs规范
 * 引入相关的js依赖，并且可以使依赖在@dcloudio/webpack-uni-pages-loader中进行热重载
 * 只可用于uni-app项目的pages.js中
 * @param mix {Object | String} loader 或者 依赖的路径
 * @param fromFilename {String} 调用方法的文件路径
 * @returns {*} mix为loader时为初始化，返回hotRequire，mix为依赖的路径时，返回依赖
 */
function uniPagesHotModule (mix = {}, fromFilename, pureRequire = false) {
    let parentPath = ''
    fromFilename = fromFilename || callsites()[1].getFileName()
    if (getPreVueContext && typeof mix === 'string') {
        fromFilename = mix
    }
    try{
        // 尝试获取调用此方法的文件所在目录
        parentPath = path.dirname(fromFilename)
    }catch(e){}

    // 保留老的api
    function hotRequire(modulesPath){
        let finalPath = path.resolve(parentPath, modulesPath)
        return require(finalPath)
    }

    if(mix && typeof mix === 'object' || getPreVueContext && typeof mix === 'string' && !pureRequire){
        let topPath
        if (getPreVueContext) {
            topPath = path.resolve(process.env.UNI_INPUT_DIR, mix)
            // 模拟一个伪函数
            mix.__proto__.addDependency = function () {}

            // 校验入口js是否存在
            try {
                require.resolve(topPath)
            } catch (e) {
                console.warn(e)
                return
            }

            uniVue3HotPathList.add(topPath)
        } else {
            topPath = path.resolve(process.env.UNI_INPUT_DIR, 'pages.js')
        }

        if (typeof mix.addDependency === 'function') {
            addDependency = mix.addDependency
            try {
                // 默认将初始化的文件添加到依赖中
                addDependency(topPath)
            } catch (e) {}

            // 变相拦截require
            Module._load = function (request, parentModule, isMain) {
                if (!request.match(/^[.\\\/]/) && !request.match(/:/) || request.match(/\.json$/i)) {
                    Module.wrap = wrap
                    return oldLoad.call(this, request, parentModule, isMain)
                }


                let isHack = false

                let tryResolve = request
                // try {
                //     tryResolve = require(request)
                // } catch (e) {}
                if (tryResolve !== topPath) {
                    // 向上寻找父模块是否是topPath
                    deepFind(parentModule, (child) => {
                        if (child.parent) return [child.parent]
                    }, (child) => {
                        if (child.filename === require.resolve(topPath)) {
                            isHack = true
                            return false
                        }
                    })
                } else {
                    isHack = true
                }

                if (!isHack) return oldLoad.call(this, request, parentModule, isMain)

                const modulePath = require.resolve(request !== topPath ? path.resolve(parentModule.path, request) : request)

                // 注入require.context
                Module.wrap = function(script) {
                    return wrap('require.context = module.constructor.hackInfo.hotRequireContext;\n' + script)
                }

                try {
                    if (getPreVueContext) {
                        uniVue3HotPathList.add(modulePath)
                    }
                    // 将模块作为依赖加到webpack的loader中
                    addDependency(modulePath)

                    const selfModule = require.cache[modulePath]
                    // 先清parent中的children里的module，避免内存泄露
                    if (selfModule && selfModule.parent && selfModule.parent.children) {
                        selfModule.parent.children.find((m, index, arr) => {
                            if (m === selfModule) {
                                arr.splice(index, 1)
                                return true
                            }
                        })
                    }
                    // 清除模块的缓存
                    delete require.cache[modulePath]
                } catch (e) {}
                // 这里应该重新执行一遍，因为之前清除了cache
                return oldLoad.call(this, request, parentModule, isMain)
            }
        }
        return hotRequire
    }

    if (typeof mix === 'string'){
        return hotRequire(mix)
    }
    throw new Error('参数错误，只接受loader或者modulePath')
}

/**
 * 模拟webpack的require.context
 * 与webpack不同的地方是不会将调用此方法的模块输出，没有id属性，resolve方法返回绝对路径
 * @param dir
 * @param deep
 * @param fileRegExp
 * @returns {function(*): *}
 */
function hotRequireContext (dir, deep = false, fileRegExp) {
    const filesMap = {}
    let topPath = ''
    let ownerPath = ''
    try{
        // 尝试获取调用此方法的文件所在目录
        ownerPath = callsites()[1].getFileName()
        topPath = ownerPath.match(/(.*)[\/\\][^\/\\]+$/)[1]
    }catch(e){}
    uniVue3HotDictList.add(topPath)
    let firstPath = path.resolve(topPath,dir)
    function findFiles (dirName) {
        fs.readdirSync(dirName).map((item)=>{
            let absolutePath =  path.resolve(dirName,item)
            if (deep) {
                // 一律都当作子目录处理
                try {
                    findFiles(absolutePath)
                    return
                } catch (e) {}
            }

            // 验证fileRegExp
            if (fileRegExp && !item.match(fileRegExp)) {
                return
            }

            // 去除自己避免死循环
            if (ownerPath === absolutePath) return

            const modulePath = absolutePath.replace(topPath,'.').replace(/\\\\/g,'/').replace(/\\/g,'/')
            if (getPreVueContext) {
                // uniVue3HotPathList.add(modulePath)
                uniPagesHotModule(absolutePath)
            }
            filesMap[modulePath] = uniPagesHotModule(absolutePath, null, true)
        })
    }
    function keys () {
        return Object.keys(filesMap)
    }

    function resolve (relativePath) {
        return path.resolve(firstPath, relativePath)
    }

    function output (id) {
        return filesMap[id]
    }

    findFiles(firstPath)
    output.keys = keys
    output.resolve = resolve
    return output
}

uniPagesHotModule.hot = function (pagesFunction) {
    const fromFilename = callsites()[1].getFileName()
    return function (pagesJson, loader) {
        uniPagesHotModule(loader, fromFilename)
        return pagesFunction.call(this, pagesJson, loader)
    }
}
uniPagesHotModule.context = hotRequireContext
// 在Module里暴露一个信息，以便require.context的注入可以获取到
Module.hackInfo = {
    hotRequireContext
}

// uni vite专用，用于注册条件编译的hotJs方法
uniPagesHotModule.setupHotJs = function (customName = 'hotJs') {
    if (getPreVueContext) {
        getPreVueContext[customName] = function (jsPath) {
            uniPagesHotModule(jsPath)
            return JSON.stringify(require(path.resolve(process.env.UNI_INPUT_DIR, jsPath)))
        }
    } else {
        throw Error('hotJs方法只支持在uni vite版本使用！')
    }
}

// uni vite专用，用于给vite.config.js添加热更新插件，此插件需配合setupHotJs使用
uniPagesHotModule.createHotVitePlugin = function() {
    const chokidarList = new Set()
    return {
        name: 'vite:uni-hot-watch',
        transform () {
            uniVue3HotPathList.forEach(jsPath => {
                this.addWatchFile(jsPath)
            })

            // rollup的缺陷（addWatchFile不能监听一个目录新增的文件触发变更）
            // 骚操作：创建一个临时文件让rollup监听，借助chokidar检测目录变换并且触发临时文件变更
            uniVue3HotDictList.forEach((dict) => {
                if (!chokidarList.has(dict)) {
                    chokidarList.add(dict)
                    chokidar.watch(dict).on("add", touchTmpFileChange);
                    chokidar.watch(dict).on("unlink", (modulePath) => {
                        uniVue3HotPathList.delete(modulePath)
                        // 延迟100毫秒，为了适应变更文件名的场景，会先创建文件再删除老文件，会触发h5的esbuild先报错，100毫秒后再更新恢复正常
                        setTimeout(touchTmpFileChange, 100)
                    });
                }
            })

            // Watch the tmp file instead of the src dir...
            this.addWatchFile(tmpfile.name);
        }
    }
}

module.exports = uniPagesHotModule
