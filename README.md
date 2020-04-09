# uni-pages-hot-modules  
## uni-app的pages.json的模块化及模块热重载  
解决uni-app的pages.json无法模块化的问题，并且解决模块热重载和缓存的问题  
  
### 安装  
```
npm i uni-pages-hot-modules -S
```
  
### 注意！  
发现uni-app每次更新对pages.js的支持度会不同，比如某个版本竟然注释掉了对pages.js的热重载依赖，这里做了兼容。只要uni-app不推翻自己的设计，此功能长久有效  

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
  
### 其他  
不支持条件编译，需要自己通过process.env.UNI_PLATFORM来判断，自定义环境的需要自己添加env变量来判断  
使用uni-pages-hot-modules引入模块必须输入全的文件名包括后缀，否则将不会进行热重载
