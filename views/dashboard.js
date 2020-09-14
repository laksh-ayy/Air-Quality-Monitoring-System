// This file needs rework

// Funtion to find the index of the start date from the list of available dates
function binary_search(da, array) {
  var left = 0;
  var right = array.length - 1;

  while (left <= right) {
    var mid = Math.floor((left + right) / 2);

    if (array[mid] === da) {
      return mid;
    } else if (array[mid] > da) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
}
// Function to generate Trend anaylsis graph
function trend_analysis_form() {
  var val = document.getElementById("trend_analysis_value").value;
  var bit = true;
  var start_date = document.getElementById("start_date_trend_analysis").value;
  var end_date = document.getElementById("end_date_trend_analysis").value;

  var temp_end_date = Date.parse(end_date);
  var temp_start_date = Date.parse(start_date);

  var all_the_dates = [];
  if (start_date > end_date) {
    document.getElementById("graph_line_plot").innerHTML =
      "Sorry the start date cannot be after end date";

    document.getElementById("graph_bar_plot").innerHTML = "";

    return;
  }
  if (temp_end_date - temp_start_date > 345600000) {
    document.getElementById("graph_line_plot").innerHTML =
      "Sorry maximum of 5 days of data can be shown at a time";

    document.getElementById("graph_bar_plot").innerHTML = "";

    return;
  }
  var dates = sessionStorage.getItem("availaible_dates").split(",");
  

  if (
    start_date >= dates[0] &&
    start_date <= dates[dates.length - 1] &&
    end_date >= dates[0] &&
    end_date <= dates[dates.length - 1]
  ) {
    var start = binary_search(start_date, dates);
    
    while (dates[start] != end_date) {
      all_the_dates.push(dates[start]);
      start = start + 1;
    }

    all_the_dates.push(dates[start]);

  } else {
    bit = false;
  }

  if (bit) {
    document.getElementById("graph_line_plot").innerHTML =
      "Please wait data is being fetched";
    document.getElementById("graph_bar_plot").innerHTML = "";
    function make_graph(data_being_fetched) {
      
      data_being_fetched.sort((a, b) => (a.date > b.date ? 1 : -1));
      var data = [];
      for (var i in data_being_fetched) {
        for (var j in data_being_fetched[i].values) {
          var dict = {};
          dict["timestamp"] = data_being_fetched[i].values[j][0];
          dict["values"] = data_being_fetched[i].values[j][1];
          data.push(dict);
        }
      }
      data.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
      var x_axis = [];
      var avg_y_axis = [];
      var max_y_axis = [];
      var min_y_axis = [];
      var list = {};
      for (var q in data) {
        var current_day = data[q];

        list[current_day.timestamp] = [];
      }
      for (var q in data) {
        var current_day = data[q];
        list[current_day.timestamp].push(current_day.values[val]);
      }

      document.getElementById("graph_line_plot").innerHTML = "";

      var avg_list = [];
      var min_list = [];
      var max_list = [];

      Object.keys(list).forEach((key, index) => {
        var temp = list[key];

        var sum = 0;
        var size = 0;
        var maximum = temp[0];
        var minimum = temp[0];
        for (var j in temp) {
          size += 1;
          sum += temp[j];

          if (temp[j] >= maximum) {
            maximum = temp[j];
          }
          if (temp[j] <= minimum) {
            minimum = temp[j];
          }
        }

        var val = sum / size;
        avg_list.push([key, val]);
        max_list.push([key, maximum]);
        min_list.push([key, minimum]);
      });

      avg_list.sort();
      max_list.sort();
      min_list.sort();

      for (var i in avg_list) {
        x_axis.push(avg_list[i][0]);
        max_y_axis.push(max_list[i][1]);
        min_y_axis.push(min_list[i][1]);
        avg_y_axis.push(avg_list[i][1]);
      }

      var data = [
        {
          x: x_axis,
          y: avg_y_axis,
          type: "scatter",
          mode: "lines",
          name: "Avg",
          line: { dash: "solid", width: 4 },
        },
        {
          x: x_axis,
          y: max_y_axis,
          type: "scatter",
          mode: "lines",
          name: "Max",
          line: { dash: "dashdot", width: 4 },
        },
        {
          x: x_axis,
          y: min_y_axis,
          type: "scatter",
          mode: "lines",
          name: "Min",
          line: { dash: "dot", width: 4 },
        },
      ];
      var layout = {
        title: start_date + " - " + end_date,

        xaxis: {
          autorange: true,
          rangeslider: { range: [start_date, end_date] },
          type: "date",
        },
        yaxis: { autorange: true },
      };
      Plotly.newPlot("graph_line_plot", data, layout, {
        responsive: true,
      });

      // Changes plot
      var trace1 = {
        x: x_axis,
        y: max_y_axis,
        name: "MAX",
        type: "bar",
      };

      var trace2 = {
        x: x_axis,
        y: avg_y_axis,
        name: "AVG",
        type: "bar",
      };

      var trace3 = {
        x: x_axis,
        y: min_y_axis,
        name: "MIN",
        type: "bar",
      };

      var data = [trace1, trace2, trace3];

      var layout = {
        title: start_date + " - " + end_date,
        xaxis: {
          autorange: true,
          rangeslider: { range: [start_date, end_date] },
          type: "date",
        },
        yaxis: { autorange: true, type: "linear" },
        barmode: "group",
      };

      Plotly.newPlot("graph_bar_plot", data, layout, {
        responsive: true,
      });
    }
    var data_being_fetched = [];

    for (var i in all_the_dates) {
      $.get("./api/dashboard_data", { date: all_the_dates[i] }).done(function (
        data
      ) {
        data_being_fetched.push(data);
        if (data_being_fetched.length === all_the_dates.length) {
          make_graph(data_being_fetched);
        }
      });
      setTimeout(() => {
        console.log("fetching");
      }, 10);
    }

    // console.log(data_being_fetched);
  } else {
    document.getElementById("graph_line_plot").innerHTML =
      "Sorry the data for these dates is not present";
    document.getElementById("graph_bar_plot").innerHTML = "";
  }
}

// Function to generate Correlation anaylsis graph
function correlation_form() {
  var xaxis = document.getElementById("xaxis").value;
  var yaxis = document.getElementById("yaxis").value;
  var bit = true;
  var start_date = document.getElementById("start_date_corr").value;
  var end_date = document.getElementById("end_date_corr").value;
  var all_the_dates = [];
  var temp_end_date = Date.parse(end_date);
  var temp_start_date = Date.parse(start_date);
  if (start_date > end_date) {
    document.getElementById("correlation_plot").innerHTML =
      "Sorry the start date cannot be after end date";
    return;
  }

  if (temp_end_date - temp_start_date > 345600000) {
    document.getElementById("correlation_plot").innerHTML =
      "Sorry maximum of 5 days of data can be shown at a time";
    return;
  }
  var dates = sessionStorage.getItem("availaible_dates").split(",");
  if (
    start_date >= dates[0] &&
    start_date <= dates[dates.length - 1] &&
    end_date >= dates[0] &&
    end_date <= dates[dates.length - 1]
  ) {
    var start = binary_search(start_date, dates);

    while (dates[start] != end_date) {
      all_the_dates.push(dates[start]);
      start = start + 1;
    }
    all_the_dates.push(dates[start]);
  } else {
    bit = false;
  }

  if (bit) {
    document.getElementById("correlation_plot").innerHTML =
      "Please wait data is being fetched";

    function make_graph(data_being_fetched) {
      data_being_fetched.sort((a, b) => (a.date > b.date ? 1 : -1));
      var data = [];
      for (var i in data_being_fetched) {
        for (var j in data_being_fetched[i].values) {
          var dict = {};
          dict["timestamp"] = data_being_fetched[i].values[j][0];
          dict["values"] = data_being_fetched[i].values[j][1];
          data.push(dict);
        }
      }
      data.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

      function getting_data(val, data) {
        var x_axis = [];
        var avg_y_axis = [];
        var max_y_axis = [];
        var min_y_axis = [];
        var list = {};
        for (var q in data) {
          var current_day = data[q];

          list[current_day.timestamp] = [];
        }
        for (var q in data) {
          var current_day = data[q];
          list[current_day.timestamp].push(current_day.values[val]);
        }

        var avg_list = [];
        var min_list = [];
        var max_list = [];

        Object.keys(list).forEach((key, index) => {
          var temp = list[key];

          var sum = 0;
          var size = 0;
          var maximum = temp[0];
          var minimum = temp[0];
          for (var j in temp) {
            size += 1;
            sum += temp[j];

            if (temp[j] >= maximum) {
              maximum = temp[j];
            }
            if (temp[j] <= minimum) {
              minimum = temp[j];
            }
          }

          var val = sum / size;
          avg_list.push([key, val]);
          max_list.push([key, maximum]);
          min_list.push([key, minimum]);
        });

        avg_list.sort();
        max_list.sort();
        min_list.sort();

        for (var i in avg_list) {
          x_axis.push(avg_list[i][0]);
          max_y_axis.push(max_list[i][1]);
          min_y_axis.push(min_list[i][1]);
          avg_y_axis.push(avg_list[i][1]);
        }

        return avg_y_axis;
      }

      var x_axis = getting_data(xaxis, data);
      var y_axis = getting_data(yaxis, data);
      document.getElementById("correlation_plot").innerHTML = "";

      var data = [
        {
          x: x_axis,
          y: y_axis,
          mode: "markers",
          type: "scatter",
          name: "Avg",
        },
      ];

      var layout = {
        title: yaxis + "vs" + xaxis,
        // uirevision:'true',
        xaxis: { autorange: true, title: xaxis },
        yaxis: { autorange: true, title: yaxis },
        // xaxis_title="x Axis Title",
        // yaxis_title="y axis title",
      };
      Plotly.newPlot("correlation_plot", data, layout, {
        // scrollZoom: true,
        responsive: true,
      });
    }

    var data_being_fetched = [];

    for (var i in all_the_dates) {
      $.get("./api/dashboard_data", { date: all_the_dates[i] }).done(function (
        data
      ) {
        data_being_fetched.push(data);
        if (data_being_fetched.length === all_the_dates.length) {
          make_graph(data_being_fetched);
        }
      });
      setTimeout(() => {
        console.log("fetching");
      }, 10);
    }
  } else {
    document.getElementById("correlation_plot").innerHTML =
      "Sorry the data for these dates is not present";
  }
}

// Function to generate Box Plots
function box_plot_form() {
  var values = [];
  for (var option of document.getElementById("multiple_select").options) {
    if (option.selected) {
      values.push(option.value);
    }
  }
  var bit = true;
  var start_date = document.getElementById("start_date_bp").value;
  var end_date = document.getElementById("end_date_bp").value;
  var temp_end_date = Date.parse(end_date);
  var temp_start_date = Date.parse(start_date);
  var all_the_dates = [];
  if (start_date > end_date) {
    document.getElementById("box_plot").innerHTML =
      "Sorry the start date cannot be after end date";
    return;
  }
  if (temp_end_date - temp_start_date > 345600000) {
    document.getElementById("box_plot").innerHTML =
      "Sorry maximum of 5 days of data can be shown at a time";
    return;
  }

  var dates = sessionStorage.getItem("availaible_dates").split(",");
  dates.sort();
  if (
    start_date >= dates[0] &&
    start_date <= dates[dates.length - 1] &&
    end_date >= dates[0] &&
    end_date <= dates[dates.length - 1]
  ) {
    var start = binary_search(start_date, dates);

    while (dates[start] != end_date) {
      all_the_dates.push(dates[start]);
      start = start + 1;
    }
    all_the_dates.push(dates[start]);
  } else {
    bit = false;
  }

  if (bit) {
    document.getElementById("box_plot").innerHTML =
      "Please wait data is being fetched";

    function make_graph(data) {
      data_being_fetched.sort((a, b) => (a.date > b.date ? 1 : -1));
      var data = [];
      for (var i in data_being_fetched) {
        for (var j in data_being_fetched[i].values) {
          var dict = {};
          dict["timestamp"] = data_being_fetched[i].values[j][0];
          dict["values"] = data_being_fetched[i].values[j][1];
          data.push(dict);
        }
      }
      data.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

      function getting_data(val, data) {
        var data_points = [];
        var date_list = [];

        var list = {};
        for (var i in data) {
          list[data[i]["timestamp"]] = [];
        }

        for (var i in data) {
          list[data[i]["timestamp"]].push(data[i]["values"][val]);
        }

        Object.keys(list).forEach((key, index) => {
          var today = key.split("T")[0];
          console.log(today);
          var temp = list[key];

          var sum = 0;
          var size = 0;
          for (var j in temp) {
            size += 1;
            sum += temp[j];
          }

          data_points.push(sum / size);
          date_list.push(today);
        });

        var ans = [data_points, date_list];
        return ans;
      }

      var datas = [];

      for (var i in values) {
        var ans = getting_data(values[i], data);

        var trace = {
          y: ans[0],
          x: ans[1],
          name: values[i],
          type: "box",
        };
        datas.push(trace);
      }
      document.getElementById("box_plot").innerHTML = "";

      var layout = {
        yaxis: {
          zeroline: false,
        },
        boxmode: "group",
      };
      Plotly.newPlot("box_plot", datas, layout, {
        // scrollZoom: true,
        responsive: true,
      });
    }

    var data_being_fetched = [];

    for (var i in all_the_dates) {
      $.get("./api/dashboard_data", { date: all_the_dates[i] }).done(function (
        data
      ) {
        data_being_fetched.push(data);
        if (data_being_fetched.length === all_the_dates.length) {
          make_graph(data_being_fetched);
        }
      });
      setTimeout(() => {
        console.log("fetching");
      }, 10);
    }

    //
  } else {
    document.getElementById("box_plot").innerHTML =
      "Sorry the data for these dates is not present";
  }
}
