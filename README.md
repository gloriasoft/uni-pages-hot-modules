# uni-pages-hot-modules  
## uni-app的pages.json的模块化及模块热重载  
解决uni-app的pages.json无法模块化的问题，并且解决模块热重载和缓存的问题  
  
### 安装  
```
npm i uni-pages-hot-modules -S
```
[pages.json模块化及使用了uni-pages-hot-modules进行模块热重载的uni-app示例项目](https://github.com/devilwjp/uni-pages-hot-modules-demo)  
  
### 注意！  
+ 发现uni-app每次更新对pages.js的支持度会不同，比如某个版本竟然注释掉了对pages.js的热重载依赖，这里做了兼容。只要uni-app不推翻自己的设计，此功能长久有效  
+ 使用uni-pages-hot-modules引入模块必须输入全的文件名包括后缀，否则将不会进行热重载  

### uni-pages-hot-modules做了什么  
```javascript
// 做了非常轻便的事情，相当于
loader.addDependency(modulePath)
delete require.cache[modulePath]
require(modulePath)
```  
  
### uni-app的“彩蛋”  
uni-app自带一个webpack loader钩子文件pages.js，在项目src目录下建立pages.js（与pages.json同级）即可生效（pages.json仍然需要存在，作为初始值，建议存放一些和路由无关的配置）。   
pages.js要求CommonJS规范，直接通过module.exports输出一个钩子函数。  
  
### pages.js输出的函数参数  
#### pagesJson < Object >  
pages.json的解析内容  
#### loader < Object >  
uni-pages-loader的钩子属性，{ addDependency < Function > }  
##### addDependency  
用于手动为uni-pages-loader添加依赖模块  

### pages.js的模块化  
由于是js，就可以实现模块的依赖，**如果不考虑模块的热重载问题，可以直接使用require引入依赖**  
但是大多数情况下，需要依赖的模块也可以通过热重载更新pages.js，由于不是webpack的标准运行依赖，所以需要手动添加依赖项(使用addDependency)，并且需要每次清除模块的缓存，因此uni-pages-hot-modules就诞生了  
  
### pages.js示例  
```javascript
module.exports=(pagesJson,loader)=>{
    // 需要将loader传入作为初始化，v0.0.6之后只需要初始化一次
    const hotRequire = require('uni-pages-hot-modules')(loader)
    let basePages = []
    let baseSubPackages = []

    return {
        // 合并pages.json的内容
        ...pagesJson,
        pages:[
            ...basePages,
            ...hotRequire('./page_modules/tabbar.js'),
            ...hotRequire('./page_modules/component.js'),
            ...hotRequire('./page_modules/appPlus.js'),
            ...hotRequire('./page_modules/module1.js')
        ],
        subPackages:[
            ...baseSubPackages,
            ...hotRequire('./subpackage_modules/api.js'),
            ...hotRequire('./subpackage_modules/extUI.js'),
            ...hotRequire('./subpackage_modules/template.js')
        ]
    }
}

```  
### 模块的规范  
被加载的模块也是CommonJS规范，通过module.exports输出   
#### module1.js示例  
```javascript
// v0.0.6之后，模块内部使用不再需要提供loader
const hotRequire = require('uni-pages-hot-modules')
module.exports=[
   {
       "path": "pages/sub/sub",
       "style": {
           "navigationBarTitleText": "sub"
       }
   },
   // 在模块里继续引入其他子模块
   ...hotRequire('./some-sub-module1.js')
]
```  
  
### API  
#### context {function}  
模拟webpack的require.context  
与webpack不同的地方是不会将调用此方法的模块输出，没有id属性，resolve方法返回绝对路径  
```javascript
const files = hotRequire.context('.', true, /\.js$/)
const modules = []
files.keys().forEach(key => {
    if (key === './index.js') return
    const item = files(key)
    modules.push(...item)
})
module.exports = modules
```
  
### 高级用法  
实现了pages.json的模块化配置以及动态热更新意义非常大，但是还能更进一步，就是将配置模块可以同样应用到uni-app的代码层引用中。  
最常见的例子就是一些router插件，比如uni-simple-router，需要在应用层代码中单独配置路由表，虽然它提供了uni-read-pages，但是也只能在刚开始导入一次，并不支持热更新。  
这里我们给出一个两全其美的方案，就是将pages.js依赖的路由模块同样可以被uni-app代码层引入并依赖（同一个js文件在两个环境中被依赖）  
1. 模块中不能使用require引入uni-pages-hot-modules，需要在pages.js中使用global命名空间引入一次即可  
2. 需要在vue.config.js中使用DefinePlugin将hotRequire和hotRequire.context分别替换成require和require.context  
3. pages.js本身不能被引用到uni-app的代码层中  
#### pages.js示例  
```javascript
/**
 * 使用global是为了之后的模块不需要再去引入uni-pages-hot-modules
 * 更重要的是为了之后可以在客户端代码直接引入模块做准备
 * 在vue.config.js中使用DefinePlugin插件，将hotRequire替换成require
 * 就可以在客户端代码引入路由模块，可用于uni-simple-router，并且做到本地和客户端代码双向热重载
 */
global.hotRequire = require('uni-pages-hot-modules')

/**
 * 输出最终的pages.json解析内容
 * @param pagesJson {Object} src/pages.json的文件解析内容（作为初始内容传入）
 * @param loader {Object} @dcloudio/webpack-uni-pages-loader会传入一个loader对象
 * @returns {Object} uni-app需要的pages.json配置内容
 */
function exportPagesConfig (pagesJson={}, loader={}) {
    // 初始化uni-pages-hot-modules（输入loader）
    hotRequire(loader)
    // pages的初始配置
    let basePages = []
    // subPackages的初始配置
    let baseSubPackages = []

    // 要输出的pages
    let pages = [
        ...basePages,
        ...hotRequire('./page_modules/index.js')
    ]

    // 要输出的subPackages
    let subPackages = [
        ...baseSubPackages,
        ...hotRequire('./subpackage_modules/api.js'),
        ...hotRequire('./subpackage_modules/extUI.js'),
        ...hotRequire('./subpackage_modules/template.js')
    ]

    return {
        // 合并pages.json的初始内容
        ...pagesJson,
        pages,
        subPackages
    }
}

module.exports = exportPagesConfig
```  
#### ./page_modules/index.js示例  
page_modules下的所有js文件都应该是路由模块文件，hotRequire.context将深层遍历所有的模块并输出  
**此文件在uni-app的应用代码中也有效（可以import和require）**  
因为pages.js中使用了global命名hotRequire，所以在后续的依赖文件中都不需要再次引入uni-pages-hot-modules，hotRequire相当于全局存在  
```javascript
const files = hotRequire.context('.', true, /\.js$/)
const modules = []
files.keys().forEach(key => {
    if (key === './index.js') return
    const item = files(key)
    modules.push(...item)
})
module.exports = modules
```  
#### uni-simple-router的router文件示例(router/index.js)  
```javascript
import Vue from 'vue'
import Router from '../common/uni-simple-router'

Vue.use(Router)
//初始化
const router = new Router({
    routes: [
        ...require('../page_modules'),
    ]//路由表
});

//全局路由前置守卫
router.beforeEach((to, from, next) => {
    next()
})
// 全局路由后置守卫
router.afterEach((to, from) => {
})
export default router;
```  
#### vue.config.js示例  
```javascript
const webpack = require('webpack')
module.exports = {
    configureWebpack: {
        plugins: [
            new webpack.DefinePlugin({
                // 在客户端包中将hotRequire替换成require
                'hotRequire':'require',
                // 在客户端包中将hotRequireContext替换成require.context（必须替换，不能只替换hotRequire）
                'hotRequire.context': 'require.context'
            })
        ]
    }
}
```
  
### 其他  
不支持条件编译，需要自己通过process.env.VUE_APP_PLATFORM来判断（不建议使用process.env.UNI_PLATFORM，因为在webpack客户端包里无法读取此环境变量，除非设置DefinePlugin），自定义环境的需要自己添加env变量来判断  
