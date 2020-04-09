const path = require('path')
const callsites = require('callsites');
module.exports=function (mix){
    let parentPath = ''
    try{
        // 尝试获取调用此方法的文件所在目录
        parentPath = callsites()[1].getFileName().match(/(.*)[\/\\][^\/\\]+$/)[1]
    }catch(e){}

    function hotRequire(modulesPath){
        let finalPath = path.resolve(parentPath,modulesPath)
        // 将模块作为依赖加到webpack的loader中
        process.UNI_PAGES_HOT_MODULES_HOOK(finalPath)
        // 清除模块的缓存
        delete require.cache[finalPath]
        return require(finalPath)
    }

    if(mix && typeof mix.addDependency === 'function'){
        process.UNI_PAGES_HOT_MODULES_HOOK = mix.addDependency
        // uni-app在新版本里注释掉了对pages.js的依赖,导致pages.js不能热重载, 这里主动手动帮他加上pages.js的依赖
        try{
            process.UNI_PAGES_HOT_MODULES_HOOK(path.resolve(parentPath, './pages.js'))
        }catch(e){}
        return hotRequire
    }else if (typeof mix === 'string'){
        return hotRequire(mix)
    }else{
        throw new Error('参数错误，只接受loader或者modulePath')
    }
}
