# uni-pages-hot-modules  
## uni-app的pages.json的模块化及模块热重载  
解决uni-app的pages.json无法模块化的问题，并且解决模块热重载和缓存的问题  

### 安装  
```
npm i uni-pages-hot-modules -S
```
[uni-app vite版本(vue3)示例项目](https://github.com/devilwjp/uni-pages-hot-modules-vite-demo)
[uni-app webpack版本(vue2)示例项目](https://github.com/devilwjp/uni-pages-hot-modules-demo)
  

# uniapp 版本分界线说明  
## vue3 vite版本 使用说明  
uniapp vue3 vite版本你不再支持pages.js的钩子，所以uni-pages-hot-modules的使用方式转变为直接在pages.json中通过特殊的`条件编译`命令插入js入口，一种非常cool的使用方式！  
```json
{
  "pages": /* #exec hotJs('./pages_moudule/index.js') */,
  "subPackages": /* #exec hotJs('./subpackage_moudule/index.js') */,
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "uni-app",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  }
}
```
### 注意！
所有插入pages.json的js都必须是commonJs规范（包括这些js依赖的其他js）  
适用于于uniapp vue3 vite版本的uni-pages-hot-modules版本要求>=1.0.0
### 使用方式  
要使pages.json中可以使用特殊的条件编译命令，需要配置项目根目录中的`vite.config.js`  
```js
// vite.config.js
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// 引入uni-pages-hot-modules
import uniHot from 'uni-pages-hot-modules'
// 安装条件编译命令，安装之后，uniapp就会支持exec hotJs的条件编译
uniHot.setupHotJs()
// 也可以自定义条件编译的方法名
// 以下执行的结果，在条件编译中将变成exec customJsFun
// uniHot.setupHotJs('customJsFun')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
    // 注册uni-pages-hot-modules的热更新vite插件
    uniHot.createHotVitePlugin(),
  ],
})
```
### API
#### hotJs (通过条件编译使用在pages.json中，也可以自定义名称)  
uniapp的条件编译是借鉴`preprocess`插件，因此具备`#exec`命令  
hotJs引入的js的`module.exports`的结果将通过`JSON.stringify`直接呈现在pages.json中  
使用前提条件，必须在`vite.config.js`中配置完成`setupHotJs`和`createHotVitePlugin`  
```js
// 在pages.json中可使用
/* #exec hotJs('./other.js') */
// #exec hotJs('./other.js')
```
#### require.context （在pages.json依赖的js中使用，见vue2 webpack版本的说明）
模拟webpack的require.context，读取指定路径下符合条件的所有文件  
___
## vue2 webpack版本 使用说明    
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
#### loader < Object > (无需关心)  
uni-pages-loader的钩子属性，{ addDependency < Function > }  
##### addDependency (无需关心)  
用于手动为uni-pages-loader添加依赖模块  

### pages.js的模块化  
由于是js，就可以实现模块的依赖，**如果不考虑模块的热重载问题，可以不使用hot高阶函数**  
但是大多数情况下，需要依赖的模块也可以通过热重载更新pages.js，由于不是webpack的标准运行依赖，所以需要手动添加依赖项(使用addDependency)，并且需要每次清除模块的缓存，因此uni-pages-hot-modules就诞生了  
  
### pages.js示例  
```javascript
const { hot } = require('uni-pages-hot-modules')
module.exports = hot((pagesJson) => {
    let basePages = []
    let baseSubPackages = []

    return {
        // 合并pages.json的内容
        ...pagesJson,
        pages:[
            ...basePages,
            ...require('./page_modules/tabbar.js'),
            ...require('./page_modules/component.js'),
            ...require('./page_modules/appPlus.js'),
            ...require('./page_modules/module1.js')
        ],
        subPackages:[
            ...baseSubPackages,
            ...require('./subpackage_modules/api.js'),
            ...require('./subpackage_modules/extUI.js'),
            ...require('./subpackage_modules/template.js')
        ]
    }
})


```  
### 模块的规范  
被加载的模块也是CommonJS规范，通过module.exports输出   
#### module1.js示例  
```javascript
module.exports=[
   {
       "path": "pages/sub/sub",
       "style": {
           "navigationBarTitleText": "sub"
       }
   },
   // 在模块里继续引入其他子模块
   ...require('./some-sub-module1.js')
]
```  
  
### API  
#### context {function}  
模拟webpack的require.context  
与webpack不同的地方是不会将调用此方法的模块输出，没有id属性，resolve方法返回绝对路径  
```javascript
const files = require.context('.', true, /\.js$/)
const modules = []
files.keys().forEach(key => {
    if (key === './index.js') return
    const item = files(key)
    modules.push(...item)
})
module.exports = modules
```  
缺陷：require.context是模拟的，所以在支持热更新时也有一定缺陷，就是新创建的文件不支持热更新，需要重新编译即可（或者手动触发一次调用require.context的文件的更新也可以达到对新文件的热更新激活），删除和修改原有文件可以很好的支持热更新  
  
### 其他  
不支持条件编译，需要自己通过process.env.VUE_APP_PLATFORM来判断（不建议使用process.env.UNI_PLATFORM，因为在webpack客户端包里无法读取此环境变量，除非设置DefinePlugin），自定义环境的需要自己添加env变量来判断  
