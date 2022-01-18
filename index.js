/**
 * 在webpack的客户端包中如果要引入pages.js的相关依赖（pages.js文件本身不能被webpack的客户端包依赖）
 * 可以在pages.js中使用global引入uni-pages-hot-modules
 * 比如 global.hotRequire = require('uni-pages-hot-modules')
 * 这样pages.js的相关依赖中就不需要再定义hotRequire
 * 在vue.config.js中使用DefinePlugin将hotRequire和hotRequire.context分别替换成require和require.context
 * 在uni-app的应用中就可以引入pages.js的相关依赖模块了。比如可以直接用于uni-simple-router
 * 并且可以做到客户端包和本地配置包的双向热重载
 */

const path = require('path')
const callsites = require('callsites')
const fs = require('fs')
const Module = require('module').Module
const deepFind = require('./deepFind')
const oldLoad = Module._load
const wrap = Module.wrap
let addDependency

/**
 * CommonJs规范
 * 引入相关的js依赖，并且可以使依赖在@dcloudio/webpack-uni-pages-loader中进行热重载
 * 只可用于uni-app项目的pages.js中
 * @param mix {Object | String} loader 或者 依赖的路径
 * @param fromFilename {String} 调用方法的文件路径
 * @returns {*} mix为loader时为初始化，返回hotRequire，mix为依赖的路径时，返回依赖
 */
function uniPagesHotModule (mix = {}, fromFilename) {
    let parentPath = ''
    fromFilename = fromFilename || callsites()[1].getFileName()
    try{
        // 尝试获取调用此方法的文件所在目录
        parentPath = path.dirname(fromFilename)
    }catch(e){}

    // 保留老的api
    function hotRequire(modulesPath){
        let finalPath = path.resolve(parentPath, modulesPath)
        return require(finalPath)
    }

    if(mix && typeof mix === 'object'){
        const topPath = path.resolve(process.env.UNI_INPUT_DIR, 'pages.js')
        if (typeof mix.addDependency === 'function') {
            addDependency = mix.addDependency
            try {
                // 默认将初始化的文件添加到依赖中
                addDependency(topPath)
            } catch (e) {}

            // 变相拦截require
            Module._load = function (request, parentModule, isMain) {
                if (!request.match(/^[.\\]/) && !request.match(/\\/) || request.match(/\.json$/i)) {
                    Module.wrap = wrap
                    return oldLoad.call(this, request, parentModule, isMain)
                }

                let isHack = false
                // 向上寻找父模块是否是topPath
                deepFind(parentModule, (child) => {
                    if (child.parent) return [child.parent]
                }, (child) => {
                    if (child.filename === topPath) {
                        isHack = true
                        return false
                    }
                })
                if (!isHack) return oldLoad.call(this, request, parentModule, isMain)

                const modulePath = path.resolve(parentModule.path, request)

                // 注入require.context
                Module.wrap = function(script) {
                    return wrap('require.context = module.constructor.hackInfo.hotRequireContext;\n' + script)
                }

                try {
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

            filesMap[absolutePath.replace(topPath,'.').replace(/\\\\/g,'/').replace(/\\/g,'/')] = uniPagesHotModule(absolutePath)
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

module.exports = uniPagesHotModule
