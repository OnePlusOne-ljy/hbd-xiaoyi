# HappyBirthday 照片墙版

这是在 [mnbvcxzz1375/HappyBirthday](https://github.com/mnbvcxzz1375/HappyBirthday) 的 `index.html` 基础上增加照片墙的静态网页。完整的新手操作写在 [部署指南](部署指南.md) 中。

主要新增 `photo-config.js`、`photo-wall.js` 和 `src/photos/`。原来的粒子蛋糕、吹蜡烛、音乐及祝福卡片保留。`vendor/` 包含运行所需的前端脚本与手势识别模型，发布时需要一并上传。

交付时照片墙使用 12 张写有 `YOUR PHOTO HERE` 的示例占位图。把自己的 JPG 照片按 `01.jpg` 到 `12.jpg` 命名，覆盖 `src/photos/` 内的同名文件即可。
