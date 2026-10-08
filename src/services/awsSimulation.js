// 4clique AWS Hydrologic Simulation Service
// Executes direct browser POST to AWS Lambda Function URL

/**
 * Executes the hydrologic twin simulation on AWS Lambda.
 * @param {number} rainfallMm - Storm rainfall depth (0 - 300 mm)
 * @param {string} intervention - "BASELINE" | "DESILT_RAJAKALUVES" | "RETENTION_BASIN"
 * @param {string} lambdaUrlOverride - Optional URL override from UI configuration
 */
export async function runAwsHydrologicSimulation(rainfallMm, intervention, lambdaUrlOverride = null) {
  const envUrl = import.meta.env.VITE_AWS_LAMBDA_URL;
  const targetUrl = (lambdaUrlOverride || envUrl || 'http://127.0.0.1:8000').trim();

  if (!targetUrl) {
    throw new Error("Missing AWS Lambda Function URL. Set VITE_AWS_LAMBDA_URL in .env or configure in the UI.");
  }

  // Validate rainfall
  const parsedRainfall = parseFloat(rainfallMm);
  if (isNaN(parsedRainfall) || parsedRainfall < 0 || parsedRainfall > 300) {
    throw new Error(`Invalid rainfall depth: ${rainfallMm} mm. Allowed range is 0 to 300 mm.`);
  }

  // Build contract payload
  const payload = {
    project: "4clique",
    rainfall_mm: parsedRainfall,
    intervention: intervention,
    target_zone: "Bellandur-ORR"
  };

  console.log("%c[4clique AWS Request]", "color: #00f0ff; font-weight: bold;", {
    endpoint: targetUrl,
    method: "POST",
    payload
  });

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // keep text
      }
      const message = errorJson?.error || errorJson?.details || errorText || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`AWS simulation failed (${response.status}): ${message}`);
    }

    const data = await response.json();
    console.log("%c[4clique AWS Response 200 OK]", "color: #10b981; font-weight: bold;", {
      durationMs,
      data
    });

    return {
      ...data,
      latencyMs: durationMs,
      rawEndpoint: targetUrl
    };

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`AWS request timed out after 15s. Ensure Lambda is responsive at ${targetUrl}`);
    }
    // Network / CORS / unreachable error
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error(`AWS Lambda connection refused or blocked by CORS. Verify '${targetUrl}' is running and allows CORS. (Check browser Network tab).`);
    }
    throw err;
  }
}
