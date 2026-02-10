# Renaiss 卡牌信息助手（油猴脚本）

## 效果图： 
![alt text](/_assets/image10.png)

作者 Twitter：[@Leosu1030](https://x.com/Leosu1030)

## 安装
1. 安装 [油猴] 浏览器扩展：`https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo`

2. 安装成功后，点击油猴，选择 [添加新脚本]
![alt text](/_assets/image.png)

3. 把这里默认的内容全删了
![alt text](/_assets/image-1.png)

4. 复制 `renaiss-tcg.user.js` 内容，直接粘贴进去，右上角点[文件] [保存]
![alt text](/_assets/image-2.png)

5. 保存文件后会跳转到 [已安装脚本] 页面，确认 [已启用]
![alt text](/_assets/image-4.png)

6. 在 Renaiss ，打开任意一张卡的页面，例如 `https://www.renaiss.xyz/card/37009156601405156437010872870162204646611730264159431402501130635364583985592`
![alt text](/_assets/image-3.png)


## 当前解析字段
- 评级机构
- 等级 / 等级描述
- 年份
- IP
- 语言/地区
- 系列/类型
- 卡号
- 卡名
- 工艺/版本

## 备注

如果无法正常使用，请从 Chrome [拓展程序管理] 页面排查两个地方：
1. 确认 Chrome 开启了 [开发者模式]
![alt text](/_assets/image-7.png)

2. 确认开启了油猴运行脚本的权限

    a. 找到 [油猴]，点击 [详情]

    ![alt text](/_assets/image-8.png)
    
    b. 有效访问的网站，输入 `https://www.renaiss.xyz/`,同时开启 [允许运行用户脚本]，

    ![alt text](/_assets/image-9.png)


# 祝大家玩的开心，抽的不是 S 就是 A