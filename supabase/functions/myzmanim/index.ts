const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const headers = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateRange(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (d <= last) {
    out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = Deno.env.get("MYZMANIM_USER");
    const key = Deno.env.get("MYZMANIM_KEY");
    if (!user || !key) throw new Error("MyZmanim credentials are missing.");

    const body = await req.json();
    const postalCode = String(body.postal_code || "").trim();
    let locationId = body.location_id ? String(body.location_id) : "";

    const singleDate = body.date ? String(body.date) : "";
    const startDate = body.start_date ? String(body.start_date) : singleDate;
    const endDate = body.end_date ? String(body.end_date) : singleDate;
    if (!startDate || !endDate) throw new Error("date or start_date/end_date is required.");

    if (!locationId) {
      if (!postalCode) throw new Error("postal_code or location_id is required.");

      const searchParams = new URLSearchParams({
        User: user,
        Key: key,
        Coding: "JS",
        Query: postalCode,
        TimeZone: "",
      });

      const searchResponse = await fetch(
        "https://api.myzmanim.com/engine1.json.aspx/searchPostal",
        { method: "POST", headers, body: searchParams }
      );
      const searchData = await searchResponse.json();
      if (searchData.ErrMsg) throw new Error(searchData.ErrMsg);
      locationId = searchData.LocationID;
    }

    const dates = dateRange(startDate, endDate);
    if (dates.length > 45) throw new Error("Date range is too large.");

    const plagHaMincha: Record<string, string> = {};
    const sunset: Record<string, string> = {};
    const candleLighting: Record<string, string> = {};
    const sunrise: Record<string, string> = {};
    let place: Record<string, unknown> | null = null;

    const results = await Promise.all(dates.map(async (date) => {
      const dayParams = new URLSearchParams({
        User: user,
        Key: key,
        Coding: "JS",
        Language: "en",
        LocationID: locationId,
        InputDate: date,
      });

      const response = await fetch(
        "https://api.myzmanim.com/engine1.json.aspx/getDay",
        { method: "POST", headers, body: dayParams }
      );
      const data = await response.json();
      if (data.ErrMsg) throw new Error(`${date}: ${data.ErrMsg}`);
      return { date, data };
    }));

    for (const { date, data } of results) {
      if (!place) {
        place = {
          name: data?.Place?.NameShort ?? null,
          city: data?.Place?.City ?? null,
          state: data?.Place?.State ?? null,
          country: data?.Place?.Country ?? null,
          postal_code: data?.Place?.PostalCode ?? null,
        };
      }

      if (data?.Zman?.PlagGra) plagHaMincha[date] = data.Zman.PlagGra;
      if (data?.Zman?.SunsetDefault) sunset[date] = data.Zman.SunsetDefault;
      if (data?.Zman?.SunriseDefault) sunrise[date] = data.Zman.SunriseDefault;

      const candleMinutes = data?.Place?.CandlelightingMinutes;
      const candleField = candleMinutes ? `Candles${candleMinutes}` : null;
      if (candleField && data?.Zman?.[candleField]) candleLighting[date] = data.Zman[candleField];
    }

    return new Response(JSON.stringify({
      success: true,
      source: "MyZmanim",
      location_id: locationId,
      place,
      times: { plagHaMincha, sunset, sunrise, candleLighting },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
