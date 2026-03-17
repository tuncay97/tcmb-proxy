const express = require("express");
const cors = require("cors");
const xml2js = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(dateObj) {
  return `${pad(dateObj.getDate())}.${pad(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;
}

function normalizeRate(value) {
  if (!value) return null;
  return String(value).trim().replace(",", ".");
}

function pickRate(currency) {
  return (
    normalizeRate(currency.ForexSelling?.[0]) ||
    normalizeRate(currency.ForexBuying?.[0]) ||
    normalizeRate(currency.BanknoteSelling?.[0]) ||
    normalizeRate(currency.BanknoteBuying?.[0]) ||
    null
  );
}

app.get("/api/tcmb-rates", async (req, res) => {
  try {
    const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`TCMB responded with status ${response.status}`);
    }

    const xmlText = await response.text();
    const parsed = await xml2js.parseStringPromise(xmlText, {
      explicitArray: true
    });

    const tarihler = parsed?.Tarih_Date;
    const currencies = tarihler?.Currency || [];

    const usd = currencies.find(c => c?.$?.CurrencyCode === "USD");
    const eur = currencies.find(c => c?.$?.CurrencyCode === "EUR");

    const tcmbDateRaw = parsed?.Tarih_Date?.$?.Date || "";
const tcmbDate = tcmbDateRaw
  ? tcmbDateRaw.split(".").join(".") // zaten formatlı geliyor
  : formatDate(new Date());

const result = {
  source: "TCMB",
  date: tcmbDate,
  usd: pickRate(usd),
  eur: pickRate(eur)
};

    res.json(result);
  } catch (error) {
    console.error("TCMB proxy error:", error);
    res.status(500).json({
      source: "TCMB",
      date: formatDate(new Date()),
      usd: null,
      eur: null,
      error: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("TCMB proxy is running.");
});

app.listen(PORT, () => {
  console.log(`TCMB proxy listening on port ${PORT}`);
});