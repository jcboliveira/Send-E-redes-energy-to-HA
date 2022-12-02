const W3CWebSocket = require("websocket").w3cwebsocket; // npm install websocket


const port = 8123;
const protocol = "ws"; // ws or wss if ssl

// long lived access token from profile > Create Token
const entityName = "e-redes";
const entityId = "energy_consumption_kwh";

// datetime must be in ISO 8601 format with timezone
// stats = [{start: '2022-01-01T00:00:00z', sum: 0},...]
// start_search_time = datetime from which to search for old total
exports.sendToHA = function (stats, start_search_time, host, access_token) {
  const client = new W3CWebSocket(
    `${protocol}://${host}:${port}/api/websocket`
  );

  let id = 1;
  const awaiting = new Set();

  client.onerror = function (e) {
    console.log("Connection Error", e);
  };

  client.onopen = function () {
    console.log("WebSocket Client Connected");
  };

  client.onclose = function () {
    console.log("WebSocket Client Closed");
  };
  
  client.onmessage = function (e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "auth_required") {
        client.send(
          JSON.stringify({
            type: "auth",
            access_token,
          })
        );
      }
      if (data.type === "auth_ok") {
        // get the last state sum
        const payload = {
          id,
          type: "history/statistics_during_period",
          start_time: start_search_time,
          end_time: stats[0].start,
          statistic_ids: [`external:${entityId}`],
          period: "hour",
        };
        console.log("request last stats");
        awaiting.add(id);
        client.send(JSON.stringify(payload));
        id++;
      }
      if (data.type === "auth_invalid") {
        console.log("Auth invalid", data);
        client.close();
      }
      if (data.type === "result") {
        awaiting.delete(data.id);
        if (!data.success) {
          console.log("Error", data.error);
        } else {
          console.log("Success", data.id);
          // collect answer and insert updated stats
          if (data.id === 1) {
            const results = data.result[`external:${entityId}`];
            if (results && results.length > 0) {
              const lastStat = results[results.length - 1];
              const sum = lastStat.sum;
              console.log("Last stat", lastStat);
              // shift all data fo a unique grand total, since last_rest does not work
              stats.forEach((stat) => {
                stat.sum += sum;
              });
            } else {
              console.log("No last stats");
            }
            const payload = {
              id,
              type: "recorder/import_statistics",
              metadata: {
                has_mean: false,
                has_sum: true,
                name: entityName,
                source: "external",
                statistic_id: `external:${entityId}`,
                unit_of_measurement: "kWh",
              },
              stats,
            };
            console.log("sending stats");
            awaiting.add(id);
            client.send(JSON.stringify(payload));
            id++;
          }
        }
        if (awaiting.size === 0) {
          client.close();
        }
      }
    } catch (e) {
      console.log(e);
    }
  };
}
