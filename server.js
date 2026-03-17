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
    normalizeRate(currency?.ForexSelling?.[0]) ||
    normalizeRate(currency?.ForexBuying?.[0]) ||
    normalizeRate(currency?.BanknoteSelling?.[0]) ||
    normalizeRate(currency?.BanknoteBuying?.[0]) ||
    null
  );
}

function formatTcmbDate(dateValue) {
  if (!dateValue) return formatDate(new Date());

  // TCMB Date alanı çoğunlukla MM/DD/YYYY gelir
  if (dateValue.includes("/")) {
    const parts = dateValue.split("/");
    if (parts.length === 3) {
      const month = pad(parts[0]);
      const day = pad(parts[1]);
      const year = parts[2];
      return `${day}.${month}.${year}`;
    }
  }

  // Zaten DD.MM.YYYY gelirse olduğu gibi kullan
  if (dateValue.includes(".")) {
    const parts = dateValue.split(".");
    if (parts.length === 3) {
      return `${pad(parts[0])}.${pad(parts[1])}.${parts[2]}`;
    }
  }

  return formatDate(new Date());
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

    const root = parsed?.Tarih_Date;
    const currencies = root?.Currency || [];

    const usd = currencies.find(c => c?.$?.CurrencyCode === "USD");
    const eur = currencies.find(c => c?.$?.CurrencyCode === "EUR");

    const tcmbDateRaw = root?.$?.Date || "";
    const tcmbDate = formatTcmbDate(tcmbDateRaw);

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