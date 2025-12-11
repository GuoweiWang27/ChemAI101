# Cloudflare Pages 部署配置

## 环境变量设置

在 Cloudflare Pages 中设置 Gemini API Key：

### 步骤：

1. 登录 Cloudflare Dashboard
2. 进入你的 Pages 项目
3. 点击 **Settings** → **Environment Variables**
4. 添加以下环境变量：

   **变量名：** `GEMINI_API_KEY`  
   **值：** 你的 Gemini API Key

   **或者使用 Vite 标准格式：**

   **变量名：** `VITE_GEMINI_API_KEY`  
   **值：** 你的 Gemini API Key

5. 选择应用环境（Production、Preview、或两者）
6. 保存后重新部署项目

### 获取 Gemini API Key：

访问：https://aistudio.google.com/app/apikey

### 注意事项：

- 环境变量会在构建时注入到代码中
- 使用 `VITE_` 前缀是 Vite 的标准做法
- 代码支持两种格式：`GEMINI_API_KEY` 或 `VITE_GEMINI_API_KEY`
- 环境变量不会出现在客户端代码中（构建时替换）

