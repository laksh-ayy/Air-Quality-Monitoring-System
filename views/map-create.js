// Funtion to setup the Leaflet Map based on the data fetched
function show(chd_sectors) {
  var data = chd_sectors;

  var map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: "shift",
    // dragging: !L.Browser.mobile,
  }).setView([30.7333, 76.7794], 12.5);
  L.tileLayer(
    "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
    {
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: "mapbox/streets-v11",
      tileSize: 512,
      zoomOffset: -1,
      accessToken:
        "pk.eyJ1IjoibWJoYXNrYXI5OCIsImEiOiJjazdtaTY0NHMwaTEwM2VwaTF2bXYzdjhuIn0.r2z17ouXwTO52a_H7P77mQ",
    }
  ).addTo(map);

  //disable default scroll
  map.scrollWheelZoom.disable();

  $("#map").bind("mousewheel DOMMouseScroll", function (event) {
    event.stopPropagation();
    if (event.ctrlKey == true) {
      event.preventDefault();
      map.scrollWheelZoom.enable();
      $("#map").removeClass("map-scroll");
      setTimeout(function () {
        map.scrollWheelZoom.disable();
      }, 1000);
    } else {
      map.scrollWheelZoom.disable();
      $("#map").addClass("map-scroll");
    }
  });

  $(window).bind("mousewheel DOMMouseScroll", function (event) {
    $("#map").removeClass("map-scroll");
  });

  map.on("click", function () {
    $("#map").removeClass("map-scroll");
  });
  map.on("mousemove", function () {
    $("#map").removeClass("map-scroll");
  });
  ///////////////////////

  var zoomHome = L.Control.zoomHome();
  zoomHome.addTo(map);

  var featuresLayer = new L.GeoJSON(data, {
    style: function (feature) {
      return { color: "#" + feature.properties.color };
    },
    onEachFeature: function (feature, marker) {
      marker.bindPopup(
        '<h3 style="color:whitesmoke' +
          ";font-size:1.5vw;" +
          '"><center>' +
          feature.properties.name +
          "<center><br>" +
          "AQI:" +
          feature.properties.aqi[0] +
          "&nbsp&nbsp(" +
          feature.properties.comment[0] +
          ")" +
          "<br>" +
          "Temp: " +
          feature.properties.temp[0] +
          "&nbsp&nbsp&nbsp&nbsp" +
          "Humidity:" +
          feature.properties.humidity[0] +
          "</h3>",
        {
          closeOnEscapeKey: true,
          closeOnClick: true,
          autoClose: true,
          className: "popupCustomClass" + feature.properties.color[0],
          // keepInView	: true,
        }
      );
      // color = feature.properties.color;
    },
  });

  map.addLayer(featuresLayer);

  var searchControl = new L.Control.Search({
    layer: featuresLayer,
    propertyName: "name",
    marker: false,
    moveToLocation: function (latlng, title, map) {
      map.fitBounds(latlng.layer.getBounds());
      var zoom = map.getBoundsZoom(latlng.layer.getBounds());
      map.setView(latlng, zoom); // access the zoom
    },
  });

  searchControl.on("search:locationfound", function (e) {
    e.layer.setStyle({
      fillColor: "#" + e.layer.feature.properties.color,
      color: "#" + e.layer.feature.properties.color,
    });
    if (e.layer._popup) e.layer.openPopup();
  });

  map.addControl(searchControl); //inizialize search control

  // CENTER CHANDIGARH ICON
  var myIcon = L.icon({
    iconUrl: "images/new.png",
    iconSize: [70, 95],
    iconAnchor: [22, 94],
    popupAnchor: [-3, -76],
    shadowSize: [68, 95],
    shadowAnchor: [22, 94],
    keepInView: true,
  });
  L.marker([30.7333, 76.7794], { icon: myIcon })
    .bindPopup('<p style="color:purple">WELCOME TO CHANDIGARH<p>', {
      // autoClose: true,
      closeOnEscapeKey: true,
      keepInView: true,
    })
    .addTo(map);
  // ///////////////////////////////

  var a;
  var p;
  var h;

  for (var i in data.features) {
    if (data.features[i].properties.name == "Sector-28") {
      a = document.getElementById("col_elante_aqi");
      p = document.getElementById("col_elante_pm");
      h = document.getElementById("col_elante_hmd");
      // set_popular_places(a, p, h);
      a.innerHTML = data.features[i].properties.aqi;
      p.innerHTML = data.features[i].properties.temp;
      h.innerHTML = data.features[i].properties.humidity;
    }
    if (data.features[i].properties.name == "Sector-12") {
      a = document.getElementById("col_pgi_aqi");
      p = document.getElementById("col_pgi_pm");
      h = document.getElementById("col_pgi_hmd");
      // set_popular_places(a, p, h);
      a.innerHTML = data.features[i].properties.aqi;
      p.innerHTML = data.features[i].properties.temp;
      h.innerHTML = data.features[i].properties.humidity;
    }
    if (data.features[i].properties.name == "Sector-6") {
      a = document.getElementById("col_sl_aqi");
      p = document.getElementById("col_sl_pm");
      h = document.getElementById("col_sl_hmd");
      // set_popular_places(a, p, h);
      a.innerHTML = data.features[i].properties.aqi;
      p.innerHTML = data.features[i].properties.temp;
      h.innerHTML = data.features[i].properties.humidity;
    }
    if (data.features[i].properties.name == "Sector-1") {
      a = document.getElementById("col_rg_aqi");
      p = document.getElementById("col_rg_pm");
      h = document.getElementById("col_rg_hmd");
      // set_popular_places(a, p, h);
      a.innerHTML = data.features[i].properties.aqi;
      p.innerHTML = data.features[i].properties.temp;
      h.innerHTML = data.features[i].properties.humidity;
    }
    if (data.features[i].properties.name == "Sector-14") {
      a = document.getElementById("col_pu_aqi");
      p = document.getElementById("col_pu_pm");
      h = document.getElementById("col_pu_hmd");
      // set_popular_places(a, p, h);
      a.innerHTML = data.features[i].properties.aqi;
      p.innerHTML = data.features[i].properties.temp;
      h.innerHTML = data.features[i].properties.humidity;
    }
    if (data.features[i].properties.name == "Sector-17") {
      a = document.getElementById("col_17_aqi");
      p = document.getElementById("col_17_pm");
      h = document.getElementById("col_17_hmd");
      // set_popular_places(a, p, h);
      a.innerHTML = data.features[i].properties.aqi;
      p.innerHTML = data.features[i].properties.temp;
      h.innerHTML = data.features[i].properties.humidity;
    }
  }
}
