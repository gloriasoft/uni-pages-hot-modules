# uni-pages-hot-modules  
## uni-app的pages.json的模块化热重载  
解决uni-app的pages.json无法模块化的问题，并且解决模块热重载和缓存的问题  
### uni-app的彩蛋  
uni-app自带一个webpack loader钩子文件pages.js，在项目src目录下建立pages.js（与pages.json同级）即可生效（pages.json仍然需要存在，作为初始值，建议存放一些和路由无关的配置）。   
pages.js要求CommonJS规范，直接通过module.exports输出一个钩子函数。  
  
### pages.js输出的函数参数  
#### pagesJson < Object >  
pages.json的解析内容  
#### loader < Object >  
uni-pages-loader的钩子属性，{ addDependency < Function > }  
##### addDependency  
用于手动为uni-pages-loader添加依赖模块  
  
### 示例  
```javascript
module.exports=(pagesJson,loader)=>{
    const hotRequire = require('uni-pages-hot-modules')(loader)
    return {
        "pages": [
            {
                "path": "pages/about/about",
                "style": {
                    "navigationBarTitleText": "测试1"
                }
            },
            ...hotRequire('./module1.js')(pagesJson,loader)
        ],
        "subPackages":[{
            "root": "pages/test",
            "pages": [{
                "path": "about",
                "style": {
                    "navigationBarTitleText": "测试"
                }
            }]
        }]
    }
}

```  
### 模块的规范  
被加载的模块建议也按照pages.js的规范返回一个函数，并接收content和loader参数，这样可以确保模块后续继续依赖其他模块可以热重载  
#### 示例  
```javascript
module.exports=(content,loader)=>{
    const hotRequire = require('uni-pages-hot-modules')(loader)
    return [
        {
            "path": "pages/sub/sub",
            "style": {
                "navigationBarTitleText": "sub"
            }
        },
        ...hotRequire('./sub-module1.js')(content,loader)
    ]
}
```

### uni-pages-hot-modules做了什么  
```javascript
// 做了非常轻便的事情，相当于
loader.addDependency(module)
delete require.cache[module]
require(module)
```
