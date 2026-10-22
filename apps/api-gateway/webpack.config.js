const {NxAppWebpackPlugin} = require('@nx/webpack/app-plugin')
const {join} = require('path');

module.exports = {
    output: {
        path:join(__dirname,'dist')
    },
    plugins:[new NxAppWebpackPlugin({
        target:"node",
        main:"./src/main.ts",
        tsConfig:"./tsconfig.json",
        assets:['src/assets'],
        compiler:"tsc",
        optimization:false,
        outputHashing:'none',
        generatePackageJson:true,   
    })]
}