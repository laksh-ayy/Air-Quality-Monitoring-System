var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require("body-parser");
var Regex = require("regex");
var Q = require("q");
var fs = require("fs");
var Promise = require("promise");
var async = require("async");
// Time Zone

const DiscoveryV1 = require("ibm-watson/discovery/v1");
const { IamAuthenticator } = require("ibm-watson/auth");
const discovery_news_credentials = require("./discovery_news.json");

const discovery = new DiscoveryV1({
  version: "2018 - 12 - 03",
  authenticator: new IamAuthenticator({
    apikey: discovery_news_credentials.credentials.apikey,
  }),
  url:
    discovery_news_credentials.credentials.url +
    "/v1/environments/system/collections/news-en/query?version=2018-12-03&count=6&filter=url%3A%22https%22%2Cmain_image_url%3A%22https%22&deduplicate=true&highlight=true&passages.count=5&natural_language_query=air%20pollution",
});

const queryParams = {
  environmentId: discovery_news_credentials.credentials.environmentId,
  collectionId: discovery_news_credentials.credentials.collectionId,
  naturalLanguageQuery: "air pollution",
  filter: "url:https,main_image_url:https",
  count: "6",
  deduplicate: "true",
};
// /////////////////

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

let mydb, cloudant;
var vendor;

var days = {};
var dataset = {};

// Working here

app.get("/api/dashboard_data", function (request, response) {
  var date = request.query.date;

  var db = fs.readFileSync("cloudant_name.txt", "utf8");
  db = JSON.parse(db);
  db = db.name;

  var current_database = cloudant.db.use(db + date);

  current_database
    .list({ include_docs: true })
    .then((body) => {
      var data = [];
      for (var i in body.rows) {
        if (body.rows[i].doc.data) {
          var t = [body.rows[i].doc.timestamp, body.rows[i].doc.data];
          data.push(t);
        }
      }

      var ans = {};
      ans["date"] = date;
      ans["values"] = data;

      response.json(ans);
    })
    .catch((err) => {
      console.log("err", err);
    });
});

app.get("/api/todays_data", function (request, response) {
  var days_temp;

  cloudant.db
    .list()
    .then((body) => {
      body.sort();
      var dates_available = body;
      var actual_server_name = body[1];
      actual_server_name = actual_server_name.split("_");
      var temp_server_name = "";
      var i = 0;
      while (i < actual_server_name.length - 1) {
        temp_server_name += actual_server_name[i];
        temp_server_name += "_";
        i += 1;
      }

      var old_server_name = fs.readFileSync("cloudant_name.txt", "utf8");
      old_server_name = JSON.parse(old_server_name);
      old_server_name = old_server_name.name;
      if (old_server_name == temp_server_name) {
        console.log("yes");
      } else {
        var t = JSON.stringify({ name: temp_server_name });
        fs.writeFileSync("cloudant_name.txt", t);
      }
      var old_server_name = fs.readFileSync("cloudant_name.txt", "utf8");
      old_server_name = JSON.parse(old_server_name);
      old_server_name = old_server_name.name;
      // HERE
      let d = new Date();

      let localTime = d.getTime();

      let localOffset = d.getTimezoneOffset() * 60000;

      let UTC = localTime + localOffset;
      let IST = UTC + 3600000 * 5.5;
      let today = new Date(IST).toISOString();
      today = today.split("T");
      today = today[0];

      var latest_data = old_server_name + today;
      console.log(latest_data);
      var database_latest = cloudant.db.use(latest_data);
      var final_data = [];
      database_latest.list({ include_docs: true }, function (err, body) {
        if (!err) {
          body.rows.forEach(function (row) {
            if (row.doc.data) {
              final_data.push(row.doc.data);
            }
          });
          // console.log(final_data.slice(0 , 57));
          dataset["data"] = final_data;
          dataset["today"] = new Date(IST).toISOString();
          var i = 1;
          var dates_having_data = [];
          while (i < dates_available.length - 2) {
            dates_having_data.push(dates_available[i]);
            i += 1;
          }
          dataset["available_days"] = dates_having_data;
          response.json(dataset);
        }
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

///////////////////////  FETCH NEWS

app.get("/api/news", function (request, response) {
  try {
    var data = fs.readFileSync("news_info.txt", "utf8");
    data = JSON.parse(data);

    if (Date.now() - data.last_time > 21600000) {
      console.log("Fetch News");
      discovery
        .query(queryParams)
        .then((queryResponse) => {
          var news = {};
          for (var i in queryResponse.result.results) {
            news[i] = [
              JSON.stringify(queryResponse.result.results[i].title),
              JSON.stringify(queryResponse.result.results[i].text),
              JSON.stringify(queryResponse.result.results[i].url),
              queryResponse.result.results[i].main_image_url,
            ];
          }
          var t = JSON.stringify({
            last_time: Date.now(),
            info: { news },
          });
          fs.writeFileSync("news_info.txt", t);
          var data = fs.readFileSync("news_info.txt", "utf8");
          data = JSON.parse(data);
          response.json(data.info);
        })
        .catch((err) => {
          console.log("error:", err);
        });
    } else {
      console.log("No Fetch News");
      response.json(data.info);
    }
  } catch (e) {
    console.log("Error:", e.stack);
  }
});

////////////////////////////////////

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require("./vcap-local.json");
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) {}

const appEnvOpts = vcapLocal ? { vcap: vcapLocal } : {};

const appEnv = cfenv.getAppEnv(appEnvOpts);
if (
  appEnv.services["cloudantNoSQLDB"] ||
  appEnv.getService(/[Cc][Ll][Oo][Uu][Dd][Aa][Nn][Tt]/)
) {
  // Load the Cloudant library.
  var Cloudant = require("@cloudant/cloudant");

  // Initialize database with credentials
  if (appEnv.services["cloudantNoSQLDB"]) {
    // CF service named 'cloudantNoSQLDB'
    cloudant = Cloudant(appEnv.services["cloudantNoSQLDB"][0].credentials);
  } else {
    // user-provided service with 'cloudant' in its name
    cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
  }
} else if (process.env.CLOUDANT_URL) {
  cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if (cloudant) {
  //////////////////////////////////////////////////////////////////////////////////

  vendor = "cloudant";
}

app.use(express.static(__dirname + "/views"));

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log(
    "To view your app, open this link in your browser: http://localhost:" + port
  );
});

// For Mobile APP
app.get("/api/todays_data/flutter_app", function (request, response) {
  var days_temp;
  var chd_sectors = {
    type: "FeatureCollection",

    features: [
      {
        type: "Feature",
        properties: {
          name: "Sector-1",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.76649, 76.800878],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.999698331352",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80523650715912, 30.76445324632033],
              [76.80644011751747, 30.7631953052192],
              [76.80672565316644, 30.76285028301419],
              [76.80868216514983, 30.7605787897794],
              [76.81050959114475, 30.758437275559857],
              [76.81115666145081, 30.757654348269625],
              [76.80870008504093, 30.75588565969548],
              [76.80627303517247, 30.754719723736287],
              [76.80720102490744, 30.75333963671494],
              [76.8070820517953, 30.752625798042175],
              [76.80582093698672, 30.75205472764361],
              [76.8045122336527, 30.752197495018436],
              [76.80358376727708, 30.752320024949256],
              [76.80063399995919, 30.755857599948342],
              [76.80053442432427, 30.755953747367585],
              [76.80043360043038, 30.75605110077771],
              [76.79698510777655, 30.760163878560206],
              [76.80494505127314, 30.764766929849998],
              [76.80523650715912, 30.76445324632033],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Rock Garden",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.76649, 76.800878],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.999698331352",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80523650715912, 30.76445324632033],
              [76.80644011751747, 30.7631953052192],
              [76.80672565316644, 30.76285028301419],
              [76.80868216514983, 30.7605787897794],
              [76.81050959114475, 30.758437275559857],
              [76.81115666145081, 30.757654348269625],
              [76.80870008504093, 30.75588565969548],
              [76.80627303517247, 30.754719723736287],
              [76.80720102490744, 30.75333963671494],
              [76.8070820517953, 30.752625798042175],
              [76.80582093698672, 30.75205472764361],
              [76.8045122336527, 30.752197495018436],
              [76.80358376727708, 30.752320024949256],
              [76.80063399995919, 30.755857599948342],
              [76.80053442432427, 30.755953747367585],
              [76.80043360043038, 30.75605110077771],
              [76.79698510777655, 30.760163878560206],
              [76.80494505127314, 30.764766929849998],
              [76.80523650715912, 30.76445324632033],
            ],
          ],
        },
      },

      {
        type: "Feature",
        properties: {
          name: "Sector-2",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.763708, 76.791686],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.292338675012",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79527087405165, 30.76220877861232],
              [76.79173254002478, 30.759900323241368],
              [76.7916319004919, 30.760012900375102],
              [76.78739711348607, 30.765058249938363],
              [76.79122422341925, 30.767076322314495],
              [76.79527087405165, 30.76220877861232],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-3",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.758175, 76.796],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.362174464772",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79531500018714, 30.762155700625158],
              [76.79698510777655, 30.760163878560206],
              [76.80043360043038, 30.75605110077771],
              [76.80053442432427, 30.755953747367585],
              [76.79692214534077, 30.7537024960734],
              [76.79682339978012, 30.753813000269815],
              [76.79181570033438, 30.759807300066882],
              [76.79173254002478, 30.759900323241368],
              [76.79527087405165, 30.76220877861232],
              [76.79531500018714, 30.762155700625158],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-4",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.750983, 76.801601],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.365939070858",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80063399995919, 30.755857599948342],
              [76.80358376727708, 30.752320024949256],
              [76.80577770028071, 30.74968890002276],
              [76.80214989989804, 30.747446180596796],
              [76.8016523005133, 30.748041500315026],
              [76.7970073003467, 30.753607200312103],
              [76.79692214534077, 30.7537024960734],
              [76.80053442432427, 30.755953747367585],
              [76.80063399995919, 30.755857599948342],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-5",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.745727, 76.805958],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.341779223824",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.81062910025281, 30.7438541003865],
              [76.81040009688701, 30.74368700994762],
              [76.8070755362071, 30.741553229897704],
              [76.80214989989804, 30.747446180596796],
              [76.80577770028071, 30.74968890002276],
              [76.81062910025281, 30.7438541003865],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-6",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.73929, 76.812163],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.483610870139",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.81208029486976, 30.742302714099026],
              [76.81299638657401, 30.741208162726593],
              [76.81461442071901, 30.739316490963347],
              [76.81588743175962, 30.73813865787281],
              [76.81708715614741, 30.73734677333499],
              [76.81526779976917, 30.733524700504574],
              [76.8140816002857, 30.73381370034207],
              [76.81368228510945, 30.734037847368825],
              [76.81308721180545, 30.73448516026201],
              [76.81235220039378, 30.73526940056246],
              [76.81196099980036, 30.735700799951985],
              [76.80907618421861, 30.739191415051835],
              [76.80771420054998, 30.740802300485825],
              [76.8070755362071, 30.741553229897704],
              [76.81040009688701, 30.74368700994762],
              [76.81062910025281, 30.7438541003865],
              [76.81208029486976, 30.742302714099026],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sukhna Lake",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.73929, 76.812163],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.483610870139",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.81208029486976, 30.742302714099026],
              [76.81299638657401, 30.741208162726593],
              [76.81461442071901, 30.739316490963347],
              [76.81588743175962, 30.73813865787281],
              [76.81708715614741, 30.73734677333499],
              [76.81526779976917, 30.733524700504574],
              [76.8140816002857, 30.73381370034207],
              [76.81368228510945, 30.734037847368825],
              [76.81308721180545, 30.73448516026201],
              [76.81235220039378, 30.73526940056246],
              [76.81196099980036, 30.735700799951985],
              [76.80907618421861, 30.739191415051835],
              [76.80771420054998, 30.740802300485825],
              [76.8070755362071, 30.741553229897704],
              [76.81040009688701, 30.74368700994762],
              [76.81062910025281, 30.7438541003865],
              [76.81208029486976, 30.742302714099026],
            ],
          ],
        },
      },

      {
        type: "Feature",
        properties: {
          name: "Sector-7",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.736099, 76.804717],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "1.02438622809",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80771420054998, 30.740802300485825],
              [76.80907618421861, 30.739191415051835],
              [76.81196099980036, 30.735700799951985],
              [76.80878624099228, 30.733706551516207],
              [76.80140159380858, 30.729022581926642],
              [76.80137588129196, 30.729049207255173],
              [76.79610920227793, 30.734695654680763],
              [76.79612783623071, 30.734707260431776],
              [76.8070755362071, 30.741553229897704],
              [76.80771420054998, 30.740802300485825],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-8",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.741558, 76.80006],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "1.05540874546",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.8070755362071, 30.741553229897704],
              [76.79612783623071, 30.734707260431776],
              [76.79610920227793, 30.734695654680763],
              [76.79097056244154, 30.74046781563726],
              [76.8013913001684, 30.74697550061893],
              [76.80214989989804, 30.747446180596796],
              [76.8070755362071, 30.741553229897704],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-9",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.746722, 76.794223],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "1.13581696037",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7970073003467, 30.753607200312103],
              [76.8016523005133, 30.748041500315026],
              [76.80214989989804, 30.747446180596796],
              [76.8013913001684, 30.74697550061893],
              [76.79097056244154, 30.74046781563726],
              [76.78564935933053, 30.746628781393213],
              [76.78673473761808, 30.747351589004666],
              [76.79692214534077, 30.7537024960734],
              [76.7970073003467, 30.753607200312103],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-10",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.752901, 76.788518],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "1.12478757715",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79181570033438, 30.759807300066882],
              [76.79682339978012, 30.753813000269815],
              [76.79692214534077, 30.7537024960734],
              [76.78673473761808, 30.747351589004666],
              [76.78564935933053, 30.746628781393213],
              [76.78055252717746, 30.752904414307352],
              [76.79173254002478, 30.759900323241368],
              [76.79181570033438, 30.759807300066882],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-11",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.759134, 76.783496],
          points: [],
          Ward_name: "1",
          Zone_name: "1",
          Area: "0.989401226102",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7916319004919, 30.760012900375102],
              [76.79173254002478, 30.759900323241368],
              [76.78055252717746, 30.752904414307352],
              [76.77586981663876, 30.758896126754905],
              [76.77630663804098, 30.759175920232565],
              [76.78739711348607, 30.765058249938363],
              [76.7916319004919, 30.760012900375102],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-12",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.763946, 76.772269],
          points: [],
          Ward_name: "2",
          Zone_name: "2",
          Area: "1.42125241293",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.78995108737286, 30.77069005190441],
              [76.7910932290693, 30.768577090260578],
              [76.79136004802785, 30.76800174988091],
              [76.79122422341925, 30.767076322314495],
              [76.78739711348607, 30.765058249938363],
              [76.77630663804098, 30.759175920232565],
              [76.77586981663876, 30.758896126754905],
              [76.77317720056743, 30.7624920003056],
              [76.77209639982902, 30.763925400037238],
              [76.77085700005057, 30.765569099934055],
              [76.77075460054442, 30.765705700657634],
              [76.76996970014159, 30.76675280020163],
              [76.76949240025414, 30.767389500425168],
              [76.7692696004118, 30.76771220055764],
              [76.76924369993685, 30.767765700326834],
              [76.76902309983626, 30.768221900320498],
              [76.77175476447087, 30.769252394782256],
              [76.77312295526025, 30.767319082609617],
              [76.77463986154044, 30.767408312443706],
              [76.77550241570395, 30.767586772111883],
              [76.77704906526219, 30.767676001945972],
              [76.77826853966144, 30.767884204892198],
              [76.77981518921968, 30.768538557008867],
              [76.78118337910973, 30.769163164948168],
              [76.78180798794835, 30.770114949845095],
              [76.78238598762329, 30.770477486346977],
              [76.782662005747, 30.770487004771496],
              [76.78436569941755, 30.770658325621298],
              [76.78679116378123, 30.770766194804082],
              [76.78995108737286, 30.77069005190441],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "PGI",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.763946, 76.772269],
          points: [],
          Ward_name: "2",
          Zone_name: "2",
          Area: "1.42125241293",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.78995108737286, 30.77069005190441],
              [76.7910932290693, 30.768577090260578],
              [76.79136004802785, 30.76800174988091],
              [76.79122422341925, 30.767076322314495],
              [76.78739711348607, 30.765058249938363],
              [76.77630663804098, 30.759175920232565],
              [76.77586981663876, 30.758896126754905],
              [76.77317720056743, 30.7624920003056],
              [76.77209639982902, 30.763925400037238],
              [76.77085700005057, 30.765569099934055],
              [76.77075460054442, 30.765705700657634],
              [76.76996970014159, 30.76675280020163],
              [76.76949240025414, 30.767389500425168],
              [76.7692696004118, 30.76771220055764],
              [76.76924369993685, 30.767765700326834],
              [76.76902309983626, 30.768221900320498],
              [76.77175476447087, 30.769252394782256],
              [76.77312295526025, 30.767319082609617],
              [76.77463986154044, 30.767408312443706],
              [76.77550241570395, 30.767586772111883],
              [76.77704906526219, 30.767676001945972],
              [76.77826853966144, 30.767884204892198],
              [76.77981518921968, 30.768538557008867],
              [76.78118337910973, 30.769163164948168],
              [76.78180798794835, 30.770114949845095],
              [76.78238598762329, 30.770477486346977],
              [76.782662005747, 30.770487004771496],
              [76.78436569941755, 30.770658325621298],
              [76.78679116378123, 30.770766194804082],
              [76.78995108737286, 30.77069005190441],
            ],
          ],
        },
      },

      {
        type: "Feature",
        properties: {
          name: "Sector-14",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.7607, 76.766713],
          points: [],
          Ward_name: "2",
          Zone_name: "2",
          Area: "1.74931282172",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76924369993685, 30.767765700326834],
              [76.7692696004118, 30.76771220055764],
              [76.76949240025414, 30.767389500425168],
              [76.76996970014159, 30.76675280020163],
              [76.77075460054442, 30.765705700657634],
              [76.77085700005057, 30.765569099934055],
              [76.77209639982902, 30.763925400037238],
              [76.77317720056743, 30.7624920003056],
              [76.77586981663876, 30.758896126754905],
              [76.76452056127494, 30.751846459046874],
              [76.76001710000924, 30.757916600470764],
              [76.75730885911662, 30.7618528656173],
              [76.7591886328492, 30.763518489186993],
              [76.76104461231904, 30.764898576208395],
              [76.76902309983626, 30.768221900320498],
              [76.76924369993685, 30.767765700326834],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Panjab univeristy",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.7607, 76.766713],
          points: [],
          Ward_name: "2",
          Zone_name: "2",
          Area: "1.74931282172",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76924369993685, 30.767765700326834],
              [76.7692696004118, 30.76771220055764],
              [76.76949240025414, 30.767389500425168],
              [76.76996970014159, 30.76675280020163],
              [76.77075460054442, 30.765705700657634],
              [76.77085700005057, 30.765569099934055],
              [76.77209639982902, 30.763925400037238],
              [76.77317720056743, 30.7624920003056],
              [76.77586981663876, 30.758896126754905],
              [76.76452056127494, 30.751846459046874],
              [76.76001710000924, 30.757916600470764],
              [76.75730885911662, 30.7618528656173],
              [76.7591886328492, 30.763518489186993],
              [76.76104461231904, 30.764898576208395],
              [76.76902309983626, 30.768221900320498],
              [76.76924369993685, 30.767765700326834],
            ],
          ],
        },
      },

      {
        type: "Feature",
        properties: {
          name: "Sector-15",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.7522, 76.772205],
          points: [],
          Ward_name: "2",
          Zone_name: "2",
          Area: "1.07519463166",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.78055252717746, 30.752904414307352],
              [76.7692777311824, 30.74582552492808],
              [76.76452056127494, 30.751846459046874],
              [76.77586981663876, 30.758896126754905],
              [76.78055252717746, 30.752904414307352],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-16",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.747461, 76.776891],
          points: [],
          Ward_name: "3",
          Zone_name: "2",
          Area: "1.12924147041",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.78564935933053, 30.746628781393213],
              [76.77541501149364, 30.74025310609602],
              [76.77429662808697, 30.739683119380516],
              [76.77424765280699, 30.739739713716858],
              [76.77410867877256, 30.739909891528328],
              [76.7692777311824, 30.74582552492808],
              [76.78055252717746, 30.752904414307352],
              [76.78564935933053, 30.746628781393213],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-17",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.740562, 76.783494],
          points: [],
          Ward_name: "3",
          Zone_name: "2",
          Area: "1.13741253457",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79097056244154, 30.74046781563726],
              [76.77971551196134, 30.7334212254093],
              [76.77429662808697, 30.739683119380516],
              [76.77541501149364, 30.74025310609602],
              [76.78564935933053, 30.746628781393213],
              [76.79097056244154, 30.74046781563726],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-18",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.734199, 76.78755],
          points: [],
          Ward_name: "17",
          Zone_name: "2",
          Area: "1.07206134942",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79610920227793, 30.734695654680763],
              [76.78483206534759, 30.727672132962596],
              [76.77971551196134, 30.7334212254093],
              [76.79097056244154, 30.74046781563726],
              [76.79610920227793, 30.734695654680763],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-19",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.728331, 76.7932],
          points: [],
          Ward_name: "17",
          Zone_name: "3",
          Area: "1.07352900012",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80137588129196, 30.729049207255173],
              [76.80140159380858, 30.729022581926642],
              [76.80060516229844, 30.728567336113713],
              [76.79005401388167, 30.72197094380408],
              [76.78483206534759, 30.727672132962596],
              [76.79610920227793, 30.734695654680763],
              [76.80137588129196, 30.729049207255173],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-20",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.721395, 76.781697],
          points: [],
          Ward_name: "16",
          Zone_name: "3",
          Area: "1.09554037861",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79005401388167, 30.72197094380408],
              [76.78940726823089, 30.72159663247868],
              [76.77848106295073, 30.714747297749625],
              [76.7733511564308, 30.720521635964758],
              [76.77339416201102, 30.72054877390684],
              [76.78483206534759, 30.727672132962596],
              [76.79005401388167, 30.72197094380408],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-21",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.726892, 76.776546],
          points: [],
          Ward_name: "17",
          Zone_name: "4",
          Area: "1.08274531709",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.78483206534759, 30.727672132962596],
              [76.77339416201102, 30.72054877390684],
              [76.7733511564308, 30.720521635964758],
              [76.76836967941722, 30.726299281886384],
              [76.76833014971669, 30.726347973879967],
              [76.77543082247456, 30.73071475977838],
              [76.77971551196134, 30.7334212254093],
              [76.78483206534759, 30.727672132962596],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-22",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.733701, 76.771585],
          points: [],
          Ward_name: "3",
          Zone_name: "2",
          Area: "1.19813257645",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.77424765280699, 30.739739713716858],
              [76.77429662808697, 30.739683119380516],
              [76.77971551196134, 30.7334212254093],
              [76.77543082247456, 30.73071475977838],
              [76.76833014971669, 30.726347973879967],
              [76.7629286389456, 30.73300143986461],
              [76.77410867877256, 30.739909891528328],
              [76.77424765280699, 30.739739713716858],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-23",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.738995, 76.765913],
          points: [],
          Ward_name: "4",
          Zone_name: "5",
          Area: "1.17491889131",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.77410867877256, 30.739909891528328],
              [76.7629286389456, 30.73300143986461],
              [76.75821368231567, 30.73896367793145],
              [76.75846060017659, 30.739226500302777],
              [76.76058687988063, 30.741463256324266],
              [76.762284030084, 30.743216517028713],
              [76.7632126439484, 30.743968113737537],
              [76.76388691424972, 30.744357990528897],
              [76.76492994705944, 30.7448319620255],
              [76.7655863550263, 30.745025973669783],
              [76.76667876781096, 30.74521580076862],
              [76.76750022295698, 30.745286025229916],
              [76.7681309579774, 30.745294387126307],
              [76.7685793257753, 30.745454898125104],
              [76.7692777311824, 30.74582552492808],
              [76.77410867877256, 30.739909891528328],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-24",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.745911, 76.761407],
          points: [],
          Ward_name: "4",
          Zone_name: "5",
          Area: "0.920078749636",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7692777311824, 30.74582552492808],
              [76.7685793257753, 30.745454898125104],
              [76.7681309579774, 30.745294387126307],
              [76.76750022295698, 30.745286025229916],
              [76.76667876781096, 30.74521580076862],
              [76.7655863550263, 30.745025973669783],
              [76.76492994705944, 30.7448319620255],
              [76.76388691424972, 30.744357990528897],
              [76.7632126439484, 30.743968113737537],
              [76.762284030084, 30.743216517028713],
              [76.76058687988063, 30.741463256324266],
              [76.75846060017659, 30.739226500302777],
              [76.75821368231567, 30.73896367793145],
              [76.75702692884977, 30.74058259071404],
              [76.7536260148288, 30.745089624086916],
              [76.76452056127494, 30.751846459046874],
              [76.7692777311824, 30.74582552492808],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-25",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.752143, 76.757809],
          points: [],
          Ward_name: "5",
          Zone_name: "5",
          Area: "1.0183014661",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76452056127494, 30.751846459046874],
              [76.7536260148288, 30.745089624086916],
              [76.74924993353767, 30.75121693271535],
              [76.76001710000924, 30.757916600470764],
              [76.76452056127494, 30.751846459046874],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-26",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.730308, 76.810615],
          points: [],
          Ward_name: "19",
          Zone_name: "1",
          Area: "0.959147059529",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.81235220039378, 30.73526940056246],
              [76.81308721180545, 30.73448516026201],
              [76.81368228510945, 30.734037847368825],
              [76.8140816002857, 30.73381370034207],
              [76.81526779976917, 30.733524700504574],
              [76.81480618405823, 30.73220871895728],
              [76.81474484939537, 30.7317796119396],
              [76.81477284169335, 30.73122289831815],
              [76.81491413507933, 30.730118688226923],
              [76.81491675570379, 30.7296900758364],
              [76.81486338723556, 30.729255095346446],
              [76.81442755328902, 30.728388557186236],
              [76.81410952243658, 30.728070191785946],
              [76.8131700393659, 30.727460396580113],
              [76.80676106217334, 30.723450306986138],
              [76.80630903593334, 30.72394085568601],
              [76.80140159380858, 30.729022581926642],
              [76.80878624099228, 30.733706551516207],
              [76.81196099980036, 30.735700799951985],
              [76.81235220039378, 30.73526940056246],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-26E",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.722561, 76.813339],
          points: [],
          Ward_name: "19",
          Zone_name: "3",
          Area: "1.02904479289",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.819855579671355, 30.71810676831285],
              [76.819141741897909, 30.713252668575933],
              [76.816705672728745, 30.714037507824798],
              [76.81575746893202, 30.714589201430613],
              [76.812372801163917, 30.717901587088647],
              [76.807186165409291, 30.723071188784502],
              [76.80676106217345, 30.723450306986251],
              [76.813170039365957, 30.727460396580113],
              [76.818526270171333, 30.722443943133555],
              [76.818894277249115, 30.722073329820319],
              [76.819498660334943, 30.721504639027955],
              [76.819926963358739, 30.721390425128106],
              [76.819969793571204, 30.720191176481762],
              [76.819855579671355, 30.71810676831285],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-27",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.722468, 76.799327],
          points: [],
          Ward_name: "18",
          Zone_name: "3",
          Area: "1.07493201193",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80630903593334, 30.72394085568601],
              [76.80676106217334, 30.723450306986138],
              [76.79547478183576, 30.716412921319318],
              [76.79005401388167, 30.72197094380408],
              [76.80060516229844, 30.728567336113713],
              [76.80140159380858, 30.729022581926642],
              [76.80630903593334, 30.72394085568601],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-28",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.717413, 76.803619],
          points: [],
          Ward_name: "18",
          Zone_name: "3",
          Area: "1.08895400316",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80718616540929, 30.723071188784388],
              [76.81237280116392, 30.717901587088647],
              [76.81231583450824, 30.717860867585046],
              [76.81193483402541, 30.717588967456948],
              [76.81170273429382, 30.717445667683478],
              [76.80811613455205, 30.71523046751213],
              [76.80775743455803, 30.71500896719016],
              [76.80767783376507, 30.71495976707962],
              [76.8074283339505, 30.714805767172493],
              [76.80699953450096, 30.71454086736719],
              [76.80690413441835, 30.714481967169093],
              [76.80608953390492, 30.713978867530784],
              [76.80110373385031, 30.710856067053896],
              [76.80107264338784, 30.710836605724808],
              [76.79547478183576, 30.716412921319318],
              [76.80676106217334, 30.723450306986138],
              [76.80718616540929, 30.723071188784388],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Elante Mall",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.717413, 76.803619],
          points: [],
          Ward_name: "18",
          Zone_name: "3",
          Area: "1.08895400316",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80718616540929, 30.723071188784388],
              [76.81237280116392, 30.717901587088647],
              [76.81231583450824, 30.717860867585046],
              [76.81193483402541, 30.717588967456948],
              [76.81170273429382, 30.717445667683478],
              [76.80811613455205, 30.71523046751213],
              [76.80775743455803, 30.71500896719016],
              [76.80767783376507, 30.71495976707962],
              [76.8074283339505, 30.714805767172493],
              [76.80699953450096, 30.71454086736719],
              [76.80690413441835, 30.714481967169093],
              [76.80608953390492, 30.713978867530784],
              [76.80110373385031, 30.710856067053896],
              [76.80107264338784, 30.710836605724808],
              [76.79547478183576, 30.716412921319318],
              [76.80676106217334, 30.723450306986138],
              [76.80718616540929, 30.723071188784388],
            ],
          ],
        },
      },

      {
        type: "Feature",
        properties: {
          name: "Sector-29",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.709959, 76.791945],
          points: [],
          Ward_name: "20",
          Zone_name: "3",
          Area: "1.08830327789",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.80107264338784, 30.710836605724808],
              [76.80102513400277, 30.710806866943415],
              [76.79559673440184, 30.70740686753294],
              [76.79534243400616, 30.707247367372133],
              [76.79524223424175, 30.707184466989588],
              [76.79500413423347, 30.70703856727613],
              [76.79436003438815, 30.706638466991706],
              [76.79427553408868, 30.70658596726861],
              [76.7909689337693, 30.704531567677748],
              [76.79068473451292, 30.704354966908227],
              [76.78999605527378, 30.70394692830814],
              [76.789179867457, 30.704843405798613],
              [76.78825612432075, 30.70573058339977],
              [76.7869925633562, 30.706662909665624],
              [76.7852257489692, 30.707838458478136],
              [76.7846562281025, 30.708272572920976],
              [76.78374208612843, 30.709076923861005],
              [76.79547478183576, 30.716412921319318],
              [76.80107264338784, 30.710836605724808],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-30",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.715789, 76.786966],
          points: [],
          Ward_name: "18",
          Zone_name: "3",
          Area: "1.10942371806",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.79547478183576, 30.716412921319318],
              [76.78374208612843, 30.709076923861005],
              [76.77848106295073, 30.714747297749625],
              [76.78940726823089, 30.72159663247868],
              [76.79005401388167, 30.72197094380408],
              [76.79547478183576, 30.716412921319318],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-31",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.702544, 76.781536],
          points: [],
          Ward_name: "22",
          Zone_name: "4",
          Area: "1.12862734011",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7846562281025, 30.708272572920976],
              [76.7852257489692, 30.707838458478136],
              [76.7869925633562, 30.706662909665624],
              [76.78825612432075, 30.70573058339977],
              [76.789179867457, 30.704843405798613],
              [76.78999605527378, 30.70394692830814],
              [76.78930953440755, 30.70354016764469],
              [76.7888087343357, 30.703227167599778],
              [76.78790093438067, 30.702659767334467],
              [76.78565263376208, 30.70125456764424],
              [76.78408543379578, 30.700255767090027],
              [76.78362373444781, 30.699961467547723],
              [76.7820794339188, 30.698977267486953],
              [76.77993113431444, 30.697649867247605],
              [76.77887353428622, 30.696996367688257],
              [76.77838053403445, 30.696697166840806],
              [76.77763108220876, 30.696614625264772],
              [76.77748055908057, 30.69684900387847],
              [76.77247690478538, 30.702035216951742],
              [76.78374208612843, 30.709076923861005],
              [76.7846562281025, 30.708272572920976],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-32",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.708393, 76.775317],
          points: [],
          Ward_name: "21",
          Zone_name: "4",
          Area: "1.07159764065",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.78374208612843, 30.709076923861005],
              [76.77247690478538, 30.702035216951742],
              [76.76726945152404, 30.707725893934935],
              [76.7672471087671, 30.707750976026773],
              [76.77287115587922, 30.711255753650164],
              [76.77784680888317, 30.71436194724612],
              [76.77848106295073, 30.714747297749625],
              [76.78374208612843, 30.709076923861005],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-33",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.71367, 76.769865],
          points: [],
          Ward_name: "16",
          Zone_name: "4",
          Area: "1.06607689037",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.77848106295073, 30.714747297749625],
              [76.77784680888317, 30.71436194724612],
              [76.77287115587922, 30.711255753650164],
              [76.7672471087671, 30.707750976026773],
              [76.76213144840767, 30.713494026827902],
              [76.76779665569114, 30.71701662361835],
              [76.7733511564308, 30.720521635964758],
              [76.77848106295073, 30.714747297749625],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-34",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.720126, 76.765574],
          points: [],
          Ward_name: "15",
          Zone_name: "4",
          Area: "1.0646537535",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76836967941722, 30.726299281886384],
              [76.7733511564308, 30.720521635964758],
              [76.76779665569114, 30.71701662361835],
              [76.76213144840767, 30.713494026827902],
              [76.75714155643772, 30.71934858367024],
              [76.76761187199037, 30.725823465880296],
              [76.76833014971669, 30.726347973879967],
              [76.76836967941722, 30.726299281886384],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-35",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.725771, 76.759458],
          points: [],
          Ward_name: "15",
          Zone_name: "5",
          Area: "1.1967228098",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76833014971669, 30.726347973879967],
              [76.76761187199037, 30.725823465880296],
              [76.75714155643772, 30.71934858367024],
              [76.75172061491452, 30.72596803819448],
              [76.7629286389456, 30.73300143986461],
              [76.76833014971669, 30.726347973879967],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-36",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.732006, 76.754544],
          points: [],
          Ward_name: "4",
          Zone_name: "5",
          Area: "1.06387242254",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7629286389456, 30.73300143986461],
              [76.75172061491452, 30.72596803819448],
              [76.75168355655097, 30.726013290281173],
              [76.74702327060749, 30.731978081523323],
              [76.75268664866996, 30.73554325851461],
              [76.75821368231567, 30.73896367793145],
              [76.7629286389456, 30.73300143986461],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-37",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.737944, 76.749695],
          points: [],
          Ward_name: "8",
          Zone_name: "5",
          Area: "1.06948183887",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.75702692884977, 30.74058259071404],
              [76.75821368231567, 30.73896367793145],
              [76.75268664866996, 30.73554325851461],
              [76.74702327060749, 30.731978081523323],
              [76.74697226285969, 30.73204336780725],
              [76.74245884519962, 30.738020752255977],
              [76.74240101339609, 30.738099633591276],
              [76.75358762906586, 30.74506581723375],
              [76.7536260148288, 30.745089624086916],
              [76.75702692884977, 30.74058259071404],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-38",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.744639, 76.744781],
          points: [],
          Ward_name: "8",
          Zone_name: "5",
          Area: "1.05435257405",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7536260148288, 30.745089624086916],
              [76.75358762906586, 30.74506581723375],
              [76.74240101339609, 30.738099633591276],
              [76.7379812790129, 30.744128046472213],
              [76.74326133004638, 30.74744966726837],
              [76.74923566849134, 30.75120805640671],
              [76.74924993353767, 30.75121693271535],
              [76.7536260148288, 30.745089624086916],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-38W",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.750061, 76.737077],
          points: [],
          Ward_name: "8",
          Zone_name: "5",
          Area: "0.581259051135",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.737425974629105, 30.75322888250696],
              [76.738258785514574, 30.752693503502428],
              [76.73968646196073, 30.751355056890418],
              [76.741322342252374, 30.749897636266951],
              [76.742631045586336, 30.748559189654941],
              [76.74326133004638, 30.74744966726837],
              [76.737981279012899, 30.744128046472213],
              [76.73361481237373, 30.750382924832195],
              [76.733142944391432, 30.751087367388152],
              [76.73323217422552, 30.753912977002358],
              [76.737277258238919, 30.754002206836446],
              [76.737425974629105, 30.75322888250696],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-39",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.74285, 76.729137],
          points: [],
          Ward_name: "9",
          Zone_name: "5",
          Area: "1.07616759222",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7379812790129, 30.744128046472213],
              [76.72660064810151, 30.737126511379472],
              [76.72223225421521, 30.74336298691236],
              [76.72272248995102, 30.74360642349768],
              [76.73361481237373, 30.750382924832195],
              [76.7379812790129, 30.744128046472213],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-40",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.737593, 76.734223],
          points: [],
          Ward_name: "9",
          Zone_name: "5",
          Area: "1.06982262205",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.74240101339609, 30.738099633591276],
              [76.7310934299179, 30.730949012486974],
              [76.72660064810151, 30.737126511379472],
              [76.7379812790129, 30.744128046472213],
              [76.74240101339609, 30.738099633591276],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-41",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.731396, 76.738431],
          points: [],
          Ward_name: "10",
          Zone_name: "5",
          Area: "0.821191997596",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.74245884519962, 30.738020752255977],
              [76.74697226285969, 30.73204336780725],
              [76.74702327060749, 30.731978081523323],
              [76.74615376468455, 30.731469013983883],
              [76.74523418720804, 30.730937581204444],
              [76.74462927262289, 30.73072911655555],
              [76.74280629197688, 30.730482438813567],
              [76.73911912644661, 30.73005589306507],
              [76.7373454754134, 30.72949070243402],
              [76.73669442290935, 30.729173060988046],
              [76.73494902587692, 30.728130799796645],
              [76.73376692820125, 30.727363091733366],
              [76.7310934299179, 30.730949012486974],
              [76.74240101339609, 30.738099633591276],
              [76.74245884519962, 30.738020752255977],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-42",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.725143, 76.743709],
          points: [],
          Ward_name: "10",
          Zone_name: "5",
          Area: "1.33407610273",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.75168355655097, 30.726013290281173],
              [76.75172061491452, 30.72596803819448],
              [76.75101080160726, 30.72552793246814],
              [76.74597220145597, 30.72238853140567],
              [76.74040626853451, 30.718903320332004],
              [76.7403993077819, 30.71891180633486],
              [76.73376692820125, 30.727363091733366],
              [76.73494902587692, 30.728130799796645],
              [76.73669442290935, 30.729173060988046],
              [76.7373454754134, 30.72949070243402],
              [76.73911912644661, 30.73005589306507],
              [76.74280629197688, 30.730482438813567],
              [76.74462927262289, 30.73072911655555],
              [76.74523418720804, 30.730937581204444],
              [76.74615376468455, 30.731469013983883],
              [76.74702327060749, 30.731978081523323],
              [76.75168355655097, 30.726013290281173],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-43",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.719056, 76.748859],
          points: [],
          Ward_name: "12",
          Zone_name: "5",
          Area: "1.20753352647",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.75714155643772, 30.71934858367024],
              [76.74588177012765, 30.71223110168404],
              [76.74583372834394, 30.712286711262777],
              [76.74040626853451, 30.718903320332004],
              [76.74597220145597, 30.72238853140567],
              [76.75101080160726, 30.72552793246814],
              [76.75172061491452, 30.72596803819448],
              [76.75714155643772, 30.71934858367024],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-44",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.712193, 76.753193],
          points: [],
          Ward_name: "15",
          Zone_name: "4",
          Area: "1.07420112341",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76213144840767, 30.713494026827902],
              [76.75090708369504, 30.706414264206956],
              [76.74588177012765, 30.71223110168404],
              [76.75714155643772, 30.71934858367024],
              [76.76213144840767, 30.713494026827902],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-45",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.706806, 76.758838],
          points: [],
          Ward_name: "14",
          Zone_name: "4",
          Area: "1.07983079973",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7672471087671, 30.707750976026773],
              [76.76659427020945, 30.707244968880275],
              [76.75598595728616, 30.700609606248406],
              [76.75090708369504, 30.706414264206956],
              [76.76213144840767, 30.713494026827902],
              [76.7672471087671, 30.707750976026773],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-46",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.701732, 76.765082],
          points: [],
          Ward_name: "21",
          Zone_name: "4",
          Area: "1.06660182552",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76726945152404, 30.707725893934935],
              [76.77247690478538, 30.702035216951742],
              [76.76115979838602, 30.694982286503375],
              [76.75598595728616, 30.700609606248406],
              [76.76659427020945, 30.707244968880275],
              [76.7672471087671, 30.707750976026773],
              [76.76726945152404, 30.707725893934935],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-47",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.695773, 76.769911],
          points: [],
          Ward_name: "22",
          Zone_name: "4",
          Area: "1.06306190349",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.77748055908057, 30.69684900387847],
              [76.77763108220876, 30.696614625264772],
              [76.77736507264007, 30.696585328050503],
              [76.7768800727572, 30.696522728041543],
              [76.7764727733998, 30.69641632835095],
              [76.77605007315242, 30.69616812805674],
              [76.77567117348593, 30.695879927716533],
              [76.77488247344746, 30.69482932801111],
              [76.77457567332874, 30.694492427583498],
              [76.77428187291014, 30.694255327621306],
              [76.77268377313766, 30.693233427980374],
              [76.77242117289887, 30.69306952833614],
              [76.77234297324969, 30.693020627699866],
              [76.76670407293466, 30.689259328355377],
              [76.7666559951781, 30.68923149074078],
              [76.76119893868014, 30.694939715295675],
              [76.76115979838602, 30.694982286503375],
              [76.77247690478538, 30.702035216951742],
              [76.77748055908057, 30.69684900387847],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-48",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.688742, 76.758472],
          points: [],
          Ward_name: "22",
          Zone_name: "6",
          Area: "1.18014509781",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.75463707314253, 30.68150782792395],
              [76.75441615108463, 30.681364181012327],
              [76.75194601649548, 30.684358333470357],
              [76.75099096975742, 30.685515985774146],
              [76.75061880331526, 30.685967103699056],
              [76.74930338294496, 30.687561612478476],
              [76.74930244585136, 30.68756274832225],
              [76.75539818467865, 30.691357302797314],
              [76.76115979838602, 30.694982286503432],
              [76.7611989386802, 30.694939715295675],
              [76.7666559951781, 30.68923149074078],
              [76.76659837291663, 30.68919812769161],
              [76.76632897290375, 30.68902422758606],
              [76.76574147279086, 30.6886864278365],
              [76.76519717341091, 30.688328428414366],
              [76.76496837329194, 30.688183828221213],
              [76.76447337294798, 30.687898628019298],
              [76.76400167313881, 30.687593427794525],
              [76.76351597268416, 30.68725212788354],
              [76.76305367348829, 30.686934828179858],
              [76.76217107343638, 30.68644892807572],
              [76.76150317303313, 30.68605132790657],
              [76.76143997317621, 30.686009628141846],
              [76.76037147336496, 30.68530402815844],
              [76.75901407264138, 30.684485028161532],
              [76.75754807338501, 30.68356632842341],
              [76.7568529729864, 30.683122227908655],
              [76.75610897285094, 30.682685228440732],
              [76.75583657269982, 30.682464927814294],
              [76.75521747310796, 30.681958328014503],
              [76.75463707314253, 30.68150782792395],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-49",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.693872, 76.752613],
          points: [],
          Ward_name: "13",
          Zone_name: "6",
          Area: "1.08997562655",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.76115979838602, 30.694982286503375],
              [76.75539818467854, 30.691357302797314],
              [76.74930244585124, 30.68756274832225],
              [76.74885008866073, 30.68811130239476],
              [76.74598329009683, 30.691587739682518],
              [76.74619422158611, 30.69257318170702],
              [76.74566122218772, 30.69306811010523],
              [76.74495690193953, 30.693277501955208],
              [76.74456697568542, 30.693483138236274],
              [76.75598595728616, 30.700609606248406],
              [76.76115979838602, 30.694982286503375],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-50",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.700442, 76.748473],
          points: [],
          Ward_name: "13",
          Zone_name: "6",
          Area: "1.04952008364",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.75598595728616, 30.700609606248406],
              [76.74456697568542, 30.693483138236274],
              [76.74430629459988, 30.693620614000167],
              [76.74005589985995, 30.698755600790378],
              [76.73960461016469, 30.699290515744735],
              [76.73984858364526, 30.69942814169542],
              [76.740045883211, 30.69956914190243],
              [76.74032428363881, 30.69973224204938],
              [76.74071568388177, 30.69981894209053],
              [76.74115948312368, 30.69984674193364],
              [76.74165578388738, 30.69990914229311],
              [76.74242868373682, 30.700123142269263],
              [76.74307608319475, 30.700384442088364],
              [76.74377408390689, 30.70080084168552],
              [76.74455048391775, 30.701665742180296],
              [76.74490588339984, 30.702299942288562],
              [76.74537548329198, 30.702968742013866],
              [76.74582090041429, 30.703250000487174],
              [76.74600639997544, 30.70334740066204],
              [76.74696470046064, 30.703987100124607],
              [76.75043759981543, 30.70612449994576],
              [76.75085069980003, 30.706378700516666],
              [76.75090708369504, 30.706414264206956],
              [76.75598595728616, 30.700609606248406],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-51",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.705922, 76.743429],
          points: [],
          Ward_name: "13",
          Zone_name: "6",
          Area: "1.01775070755",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.75090708369504, 30.706414264206956],
              [76.75085069980003, 30.706378700516666],
              [76.75043759981543, 30.70612449994576],
              [76.74696470046064, 30.703987100124607],
              [76.74600639997544, 30.70334740066204],
              [76.74582090041429, 30.703250000487174],
              [76.74537548329198, 30.702968742013866],
              [76.74490588339984, 30.702299942288562],
              [76.74455048391775, 30.701665742180296],
              [76.74377408390689, 30.70080084168552],
              [76.74307608319475, 30.700384442088364],
              [76.74242868373682, 30.700123142269263],
              [76.74165578388738, 30.69990914229311],
              [76.74115948312368, 30.69984674193364],
              [76.74071568388177, 30.69981894209053],
              [76.74032428363881, 30.69973224204938],
              [76.740045883211, 30.69956914190243],
              [76.73984858364526, 30.69942814169542],
              [76.73960461016469, 30.699290515744735],
              [76.7382204249327, 30.700932203858144],
              [76.737947009447, 30.70243961689488],
              [76.73822064796457, 30.70284412565593],
              [76.73848238845153, 30.703153455567588],
              [76.73844669615818, 30.703653142278768],
              [76.73843479902683, 30.704366980052157],
              [76.73744732273582, 30.705509121748605],
              [76.73658159576411, 30.705771734577922],
              [76.73572092028428, 30.706016994988374],
              [76.73662733438402, 30.706533590752656],
              [76.73860572147692, 30.7073983347654],
              [76.73943816094243, 30.70798357668076],
              [76.74068031084772, 30.70911813709239],
              [76.74588177012765, 30.71223110168404],
              [76.75090708369504, 30.706414264206956],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-52",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.710829, 76.736305],
          points: [],
          Ward_name: "12",
          Zone_name: "6",
          Area: "1.29035770009",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.74583372834394, 30.712286711262777],
              [76.74588177012765, 30.71223110168404],
              [76.74068031084772, 30.70911813709239],
              [76.73943816094243, 30.70798357668076],
              [76.73860572147692, 30.7073983347654],
              [76.73662733438402, 30.706533590752656],
              [76.73572092028428, 30.706016994988374],
              [76.7352205437931, 30.706076306176612],
              [76.7342782773207, 30.706361840926263],
              [76.73345188309798, 30.706595558538254],
              [76.72940930009918, 30.7114195588656],
              [76.7294868360487, 30.711807237713913],
              [76.72958328384152, 30.712084856630895],
              [76.73091348456973, 30.71294315790044],
              [76.73126375791617, 30.71316916922183],
              [76.73198102120722, 30.713899089571385],
              [76.73318455961981, 30.715485704102036],
              [76.73473161387295, 30.717722213709237],
              [76.7349892795317, 30.71790911351485],
              [76.73536123193537, 30.718023331011977],
              [76.73621911681886, 30.718149909690624],
              [76.73648587012684, 30.718129204599165],
              [76.736769454247, 30.718030627211704],
              [76.73752515366294, 30.717792606343778],
              [76.7381137212713, 30.7177848496911],
              [76.73853491245632, 30.71784457996347],
              [76.7389554417403, 30.71802689232726],
              [76.74040626853451, 30.718903320332004],
              [76.74583372834394, 30.712286711262777],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-53",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.719407, 76.73298],
          points: [],
          Ward_name: "11",
          Zone_name: "6",
          Area: "0.716885066595",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7403993077819, 30.71891180633486],
              [76.74040626853451, 30.718903320332004],
              [76.7389554417403, 30.71802689232726],
              [76.73853491245632, 30.71784457996347],
              [76.7381137212713, 30.7177848496911],
              [76.73752515366294, 30.717792606343778],
              [76.736769454247, 30.718030627211704],
              [76.73648587012684, 30.718129204599165],
              [76.73621911681886, 30.718149909690624],
              [76.73536123193537, 30.718023331011977],
              [76.7349892795317, 30.71790911351485],
              [76.73473161387295, 30.717722213709237],
              [76.73318455961981, 30.715485704102036],
              [76.73198102120722, 30.713899089571385],
              [76.73126375791617, 30.71316916922183],
              [76.73091348456973, 30.71294315790044],
              [76.73036872383761, 30.713585884481063],
              [76.72953591205277, 30.71445438765994],
              [76.72883397141072, 30.71528719944473],
              [76.7294288369713, 30.71577736863071],
              [76.73130385149159, 30.716976616377792],
              [76.73118963759174, 30.717433472876507],
              [76.73128481644119, 30.718280561398842],
              [76.7313363709768, 30.719041988596928],
              [76.73125309015802, 30.719410805064626],
              [76.73119360360198, 30.720255513980817],
              [76.7313363709768, 30.721445244202698],
              [76.73122929589533, 30.721802163539053],
              [76.73102976780962, 30.72189015410737],
              [76.73048717534294, 30.72169305239248],
              [76.730732649792, 30.721863533275496],
              [76.73139123501755, 30.72248125780385],
              [76.73156101532862, 30.722752145295317],
              [76.73175637865398, 30.723269463215217],
              [76.73201378800599, 30.72524060986632],
              [76.7322242671363, 30.72583326759127],
              [76.73251448285714, 30.72633782143339],
              [76.73326250745879, 30.727059406866204],
              [76.73376692820125, 30.727363091733366],
              [76.7403993077819, 30.71891180633486],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-54",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.724277, 76.727702],
          points: [],
          Ward_name: "11",
          Zone_name: "6",
          Area: "0.419370526569",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.73376692820125, 30.727363091733366],
              [76.73326250745879, 30.727059406866204],
              [76.73251448285714, 30.72633782143339],
              [76.7322242671363, 30.72583326759127],
              [76.73201378800599, 30.72524060986632],
              [76.73175637865398, 30.723269463215217],
              [76.73156101532862, 30.722752145295317],
              [76.73139123501755, 30.72248125780385],
              [76.730732649792, 30.721863533275496],
              [76.73048717534294, 30.72169305239248],
              [76.72956639907011, 30.722782451548937],
              [76.72914999317771, 30.723365419978222],
              [76.72847184679836, 30.723960285538794],
              [76.72781749558101, 30.724114950044964],
              [76.72732970600117, 30.724555150200047],
              [76.72665155962181, 30.725423653378925],
              [76.72583064586769, 30.726339745982557],
              [76.72530195332257, 30.727355448395258],
              [76.7310934299179, 30.730949012486974],
              [76.73376692820125, 30.727363091733366],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-55",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.730456, 76.720899],
          points: [],
          Ward_name: "11",
          Zone_name: "6",
          Area: "0.648417855247",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.7310934299179, 30.730949012486974],
              [76.72530195332257, 30.727355448395258],
              [76.7249178249977, 30.728355843447446],
              [76.72464656608622, 30.728370120184934],
              [76.72384706698858, 30.728370120184934],
              [76.72319033616515, 30.728484334084783],
              [76.72279058661633, 30.729241002969957],
              [76.72254788117982, 30.729312386657398],
              [76.72233373011761, 30.729540815356415],
              [76.72183404340643, 30.729983395117642],
              [76.7212058651586, 30.730254653129805],
              [76.72087750019654, 30.730740063103497],
              [76.72014938478634, 30.730968491802514],
              [76.71898533020885, 30.73242823537481],
              [76.72660064810151, 30.737126511379472],
              [76.7310934299179, 30.730949012486974],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Sector-56",
          aqi: ["No Data"],
          temp: ["No Data"],
          humidity: ["No Data"],
          color: ["a8a8a8"],
          comment: ["No Data"],
          loc: [30.735657, 76.717079],
          points: [],
          Ward_name: "11",
          Zone_name: "6",
          Area: "0.721975627106",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [76.72660064810151, 30.737126511379472],
              [76.71898533020885, 30.73242823537481],
              [76.71747249156232, 30.734180764031066],
              [76.71692331156163, 30.7357654854888],
              [76.71624754478842, 30.73664112658679],
              [76.71517202846638, 30.73794507160784],
              [76.71464256610159, 30.738654992833688],
              [76.71512937542042, 30.73896124616465],
              [76.72172895672605, 30.743113064416434],
              [76.72223225421521, 30.74336298691236],
              [76.72660064810151, 30.737126511379472],
            ],
          ],
        },
      },
    ],
  };

  cloudant.db
    .list()
    .then((body) => {
      body.sort();
      var dates_available = body;
      var actual_server_name = body[1];
      actual_server_name = actual_server_name.split("_");
      var temp_server_name = "";
      var i = 0;
      while (i < actual_server_name.length - 1) {
        temp_server_name += actual_server_name[i];
        temp_server_name += "_";
        i += 1;
      }

      var old_server_name = fs.readFileSync("cloudant_name.txt", "utf8");
      old_server_name = JSON.parse(old_server_name);
      old_server_name = old_server_name.name;
      if (old_server_name == temp_server_name) {
        console.log("yes");
      } else {
        var t = JSON.stringify({ name: temp_server_name });
        fs.writeFileSync("cloudant_name.txt", t);
      }
      var old_server_name = fs.readFileSync("cloudant_name.txt", "utf8");
      old_server_name = JSON.parse(old_server_name);
      old_server_name = old_server_name.name;

      let d = new Date();
      let localTime = d.getTime();
      let localOffset = d.getTimezoneOffset() * 60000;
      let UTC = localTime + localOffset;
      let IST = UTC + 3600000 * 5.5;
      let today = new Date(IST).toISOString();
      today = today.split("T");
      today = today[0];

      var latest_data = old_server_name + today;
      console.log(latest_data);
      var database_latest = cloudant.db.use(latest_data);
      var final_data = [];
      database_latest.list({ include_docs: true }, function (err, body) {
        if (!err) {
          body.rows.forEach(function (row) {
            if (row.doc.data) {
              var lat = row.doc.data["latitude"];
              var long = row.doc.data["longitude"];

              for (var i in chd_sectors.features) {
                var temp_distance = Math.sqrt(
                  (lat - chd_sectors.features[i].properties.loc[0]) ** 2 +
                    (long - chd_sectors.features[i].properties.loc[1]) ** 2
                );
                if (temp_distance < 0.006) {
                  chd_sectors.features[i].properties.points.push(row.doc.data);
                }
              }
            }
          });

          for (var i in chd_sectors.features) {
            var AQI = 0;
            var temp = 0;
            var Humidity = 0;

            if (chd_sectors.features[i].properties.points.length > 0) {
              for (var j in chd_sectors.features[i].properties.points) {
                AQI += chd_sectors.features[i].properties.points[j]["AQI"];
                temp += chd_sectors.features[i].properties.points[j]["temp"];
                Humidity +=
                  chd_sectors.features[i].properties.points[j]["Humidity"];
              }

              AQI /= chd_sectors.features[i].properties.points.length;
              AQI = Math.floor(AQI);
              temp /= chd_sectors.features[i].properties.points.length;
              temp = Math.floor(temp);
              Humidity /= chd_sectors.features[i].properties.points.length;
              Humidity = Math.floor(Humidity);

              chd_sectors.features[i].properties.aqi.pop();
              chd_sectors.features[i].properties.aqi.push(AQI);
              chd_sectors.features[i].properties.temp.pop();
              chd_sectors.features[i].properties.temp.push(temp);
              chd_sectors.features[i].properties.humidity.pop();
              chd_sectors.features[i].properties.humidity.push(Humidity);

              function getColor(d) {
                if (d <= 50 && d >= 0) {
                  return "a2c03b";
                } else if (d > 50 && d <= 100) {
                  return "ffcc00";
                } else if (d > 100 && d <= 150) {
                  return "ff9933";
                } else if (d > 150 && d <= 300) {
                  return "ea572a";
                } else if (d > 300) {
                  return "cc2600";
                }
              }

              chd_sectors.features[i].properties.color.pop();
              chd_sectors.features[i].properties.comment.pop();
              chd_sectors.features[i].properties.color.push(getColor(AQI));
              if (chd_sectors.features[i].properties.color[0] == "a2c03b") {
                chd_sectors.features[i].properties.comment.push("GOOD");
              } else if (
                chd_sectors.features[i].properties.color[0] == "ffcc00"
              ) {
                chd_sectors.features[i].properties.comment.push("MODERATE");
              } else if (
                chd_sectors.features[i].properties.color[0] == "ff9933"
              ) {
                chd_sectors.features[i].properties.comment.push("POOR");
              } else if (
                chd_sectors.features[i].properties.color[0] == "ea572a"
              ) {
                chd_sectors.features[i].properties.comment.push("UNHEALTHY");
              } else if (
                chd_sectors.features[i].properties.color[0] == "cc2600"
              ) {
                chd_sectors.features[i].properties.comment.push("HAZARDOUS");
              }
            }
          }

          let to_be_returned = [];
          chd_sectors.features.forEach((sector) => {
            let temp = {};
            temp.name = sector.properties.name;
            temp.aqi = sector.properties.aqi;
            temp.temp = sector.properties.temp;
            temp.humidity = sector.properties.humidity;
            temp.color = sector.properties.color;
            temp.comment = sector.properties.comment;
            to_be_returned.push(temp);
          });

          response.json(to_be_returned);
        }
      });
    })
    .catch((err) => {
      console.log(err);
    });
});
