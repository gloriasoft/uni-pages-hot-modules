const path = require('path')
const callsites = require('callsites');
module.exports=function (loader){
    let parentPath = ''
    try{
        // 尝试获取调用此方法的文件所在目录
        parentPath = callsites()[1].getFileName().match(/(.*)[\/\\][^\/\\]+$/)[1]
    }catch(e){}
    return function(modulesPath){
        let finalPath = path.resolve(parentPath,modulesPath)
        // 将模块作为依赖加到webpack的loader中
        loader.addDependency(finalPath)
        // 清除模块的缓存
        delete require.cache[finalPath]
        return require(finalPath)
    }
}
