// Setting up the AQI information section 
function set_info(color) {
  text = {
    a2c03b:
      "Air quality is considered satisfactory, and air pollution poses little or no risk.",
    ffcc00:
      "Air quality is acceptable, however may cause moderate health concern for a very small number of people who are usnusually sensitive to air pullution",
    ff9933:
      "Member of sensitive groups may experience health effects. The general public is not likely to be affected.",
    ea572a:
      "Everyone may begin to experience health effects, and members of sensitive groups may experience more serious health effects.",
    cc2600:
      "Health warnings of emergency conditions. The entire population is more likely to be affected.",
  };
  heading = {
    a2c03b: "GOOD 0-50",
    ffcc00: "MODERATE 51-100",
    ff9933: "POOR 101-150",
    ea572a: "UNHEALTHY 151-200",
    cc2600: "HAZARDOUS 201-250",
  };

  document.getElementById("showing-info-image").src =
    "images/" + color + ".png";

  document.getElementById("showing-info-text-heading").innerHTML =
    heading[color];
  document.getElementById("showing-info-text-paragraph").innerHTML =
    text[color];
  var a = document.getElementById("showing-info-text-heading");
  a.style["color"] = "#" + color;
  var b = document.getElementById("showing-info-text-paragraph");
  b.style["color"] = "#" + color;
  location.href = "#";
  location.href = "#final_focus";
}
