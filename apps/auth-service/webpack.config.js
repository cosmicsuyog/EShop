const {NxAppWebpackPlugin} = require('@nx/webpack/app-plugin')
const {join ,resolve} = require('path');

module.exports = {
    output: {
        path:join(__dirname,'dist')
    },
    resolve:{
        alias:{
            "@packages": resolve(__dirname,"../../packages"),
            "Packages": resolve(__dirname,"../../Packages"),

        },
        extensions:[ ".ts",".js"],
    },
    plugins:[new NxAppWebpackPlugin({
        target:"node",
        main:"./src/main.ts",
        tsConfig:"./tsconfig.json",
        compiler:"tsc",
        optimization:false,
        outputHashing:'none',
        generatePackageJson:true,   
    })]
}