// Function to generate news cards
function create_news(data) {
  data = data.news;

  for (var i in data) {

    const ulrChecker = /http:\/\//i
    
    console.log(ulrChecker.test(data[i][2]));

    if(ulrChecker.test(data[i][3]) || ulrChecker.test(data[i][2]) ){
      continue;
    }
    
    var url = data[i][2].split('"');

    const row = document.querySelector("#news_section #news_row");

    const card = document.createElement("div");
    card.setAttribute("class", "col-10 col-lg-4 d-flex align-items-stretch");
    const card_level1 = document.createElement("div");
    card_level1.setAttribute("class", "card");

    const image = document.createElement("img");
    image.setAttribute("class", "card-img-top");
    image.setAttribute("src", data[i][3]);
    image.setAttribute("alt", "No Image");
    image.setAttribute("onerror", 'this.src="./images/no_image.png"');
    const card_body = document.createElement("div");
    card_body.setAttribute("class", "card-body");
    const card_title = document.createElement("h5");
    card_title.textContent = data[i][0];
    card_title.setAttribute("class", "card-title");
    const card_text = document.createElement("p");
    card_text.textContent = data[i][1];
    card_text.setAttribute("class", "card-text");

    const a_link = document.createElement("a");
    a_link.textContent = "Go THERE";
    a_link.setAttribute("class", "btn btn-success");
    a_link.setAttribute("href", url[1]);
    a_link.setAttribute("target", "_blank");
    a_link.setAttribute("rel", "noopener noreferrer");

    card_level1.appendChild(image);
    card.appendChild(card_level1);
    const overlay = document.createElement("div");
    overlay.setAttribute("class", "overlay");
    card.appendChild(overlay);
    card_body.appendChild(card_title);

    card_body.appendChild(a_link);
    card_level1.appendChild(card_body);

    row.appendChild(card);
  }

  $(function () {
    $(".multiple-items").slick({
      arrows: false,
      dots: true,
      appendDots: ".slick_dots",
      autoplay: true,
      autoplaySpeed: 4000,
      infinite: true,
      centerMode: true,
      centerPadding: "0",
      focusOnSelec: true,
      swipeToSlide: true,
      cssEase: "linear",

      slidesToShow: 3,

      initialSlide: 2,

      responsive: [
        {
          breakpoint: 1024,
          settings: {
            slidesToShow: 3,
            slidesToScroll: 3,
          },
        },
        {
          breakpoint: 767,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1,
            centerPadding: "10vw",
          },
        },
        {
          breakpoint: 480,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1,
            centerPadding: "10vw",
          },
        },
      ],
    });
  }).on("setPosition", function (event, slick) {
    slick.$slides.css("height", slick.$slideTrack.height() + "px");
  });
}
