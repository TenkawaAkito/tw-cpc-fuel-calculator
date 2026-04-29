import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_URL = "https://vipmbr.cpc.com.tw/mbwebs/showhistoryprice_oil.aspx";
const REFERENCE_URL = "https://gasoline.transmit-info.com/";
const OUTPUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "data", "prices.json");

async function main() {
  const officialHtml = await fetchText(OFFICIAL_URL);
  const officialData = extractOfficialPrices(officialHtml);

  if (!officialData) {
    throw new Error("無法從台灣中油官方頁面解析 92 / 95 油價。");
  }

  const referenceCheck = await getReferenceCheck(officialData).catch((error) => {
    console.warn(`[warning] 第三方參考資料抓取失敗：${error.message}`);
    return {
      status: "warning",
      message: `第三方參考資料抓取失敗：${error.message}`,
    };
  });

  const payload = {
    source: "台灣中油官方汽、柴、燃油歷史價格",
    officialUrl: OFFICIAL_URL,
    referenceUrl: REFERENCE_URL,
    effectiveDate: officialData.effectiveDate,
    updatedAt: getTaipeiIsoTimestamp(),
    fuels: {
      "92": {
        name: "92 無鉛",
        price: officialData.price92,
      },
      "95": {
        name: "95 無鉛",
        price: officialData.price95,
      },
    },
    referenceCheck,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`已更新油價資料：${officialData.effectiveDate}，92=${officialData.price92}，95=${officialData.price95}`);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "tw-cpc-fuel-calculator/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractOfficialPrices(html) {
  const rowMatch = findOfficialRowFromTable(html) ?? findOfficialRowFromPlainText(html);

  if (!rowMatch) {
    return null;
  }

  const [effectiveDate, price92, price95] = rowMatch;

  if (!effectiveDate || !Number.isFinite(price92) || !Number.isFinite(price95)) {
    return null;
  }

  return {
    effectiveDate,
    price92,
    price95,
  };
}

function findOfficialRowFromTable(html) {
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowPattern.exec(html)) !== null) {
    const rowHtml = match[1];
    const cellMatches = [...rowHtml.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)];

    if (cellMatches.length < 3) {
      continue;
    }

    const cells = cellMatches.map((cell) => cleanText(cell[1]));
    const effectiveDate = cells[0];
    const price92 = parsePrice(cells[1]);
    const price95 = parsePrice(cells[2]);

    if (isDateString(effectiveDate) && Number.isFinite(price92) && Number.isFinite(price95)) {
      return [effectiveDate, price92, price95];
    }
  }

  return null;
}

function findOfficialRowFromPlainText(html) {
  const text = cleanText(html);
  const rowPattern = /(\d{4}\/\d{1,2}\/\d{1,2})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g;
  const match = rowPattern.exec(text);

  if (!match) {
    return null;
  }

  return [match[1], Number(match[2]), Number(match[3])];
}

async function getReferenceCheck(officialData) {
  const referenceHtml = await fetchText(REFERENCE_URL);
  const referenceData = extractReferencePrices(referenceHtml);

  if (!referenceData) {
    return {
      status: "warning",
      message: "第三方頁面格式無法解析，已略過比對。",
    };
  }

  const same92 = nearlyEqual(referenceData.price92, officialData.price92);
  const same95 = nearlyEqual(referenceData.price95, officialData.price95);

  if (same92 && same95) {
    return {
      status: "matched",
      message: `第三方顯示 92=${referenceData.price92}、95=${referenceData.price95}，與官方一致。`,
    };
  }

  return {
    status: "mismatch",
    message: `第三方顯示 92=${referenceData.price92}、95=${referenceData.price95}，與官方 92=${officialData.price92}、95=${officialData.price95} 不一致。`,
  };
}

function extractReferencePrices(html) {
  const text = cleanText(html);
  const blockMatch = text.match(/台灣中油\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);

  if (blockMatch) {
    return {
      price95: Number(blockMatch[2]),
      price92: Number(blockMatch[3]),
    };
  }

  const altMatch = text.match(/95\s+(\d+(?:\.\d+)?)\s+台灣中油[\s\S]*?92\s+(\d+(?:\.\d+)?)\s+台灣中油/);

  if (!altMatch) {
    return null;
  }

  return {
    price95: Number(altMatch[1]),
    price92: Number(altMatch[2]),
  };
}

function cleanText(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  const match = String(value).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function isDateString(value) {
  return /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value);
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) < 0.0001;
}

function getTaipeiIsoTimestamp() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

main().catch((error) => {
  console.error(`[error] ${error.message}`);
  process.exitCode = 1;
});
