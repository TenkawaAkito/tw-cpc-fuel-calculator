# 台灣中油 92 / 95 油價計算器

這個倉庫提供一個可部署到 GitHub Pages 的靜態網站，用來顯示台灣中油最新 92 / 95 無鉛汽油價格，並提供金額與公升的雙向換算。

## 功能

- 顯示最新 92 / 95 無鉛油價
- 切換油品種類
- 輸入付款金額，計算可加公升數
- 輸入公升數，計算應付金額
- GitHub Actions 定期抓取官方油價並更新 `data/prices.json`

## 資料來源

- 官方：台灣中油汽、柴、燃油歷史價格
- 參考：`gasoline.transmit-info.com`（僅供參考）

## 部署

請在 GitHub Repository 的 Pages 設定中選擇使用 GitHub Actions 作為發佈來源。
