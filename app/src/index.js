const apiKey = require("./apiKey");
const userMoviesService = require("./userMoviesService");
const R = require("ramda");

const appendElementToParent = R.curry((parent, el) => {
  document.getElementById(parent).appendChild(el.content.firstElementChild);
});

// createFavoriteMovieTemplate :: (Number -> [String]) -> Movie -> String
const createFavoriteMovieTemplate = R.curry(function(ratingsOptions, movie) {
  return `<li><span>${movie.title}</span> 
    <select class="movie-rating" data-movie-id="${movie.id}">
      ${ratingsOptions(movie.rating)}
    </select> 
    <a href="#" class="remove-favorite" data-movie-id="${
      movie.id
    }">Remove</a></li>`;
});

// reversedRange :: Number -> Number -> [Number]
const reversedRange = R.compose(
  R.reverse,
  R.range
);

function ratingsOptions(r) {
  return [
    "<option>Rate this movie</option>",
    ...reversedRange(1, 11).map(
      i => `<option ${i == r ? "selected" : ""}>${i}</option>`
    )
  ];
}

const log = R.curry((prefix, data) => console.log(prefix, data));

// isNotNil :: a -> Boolean
const isNotNil = R.compose(
  R.not,
  R.isNil
);

// hasPoster :: Movie -> Boolean
const hasPoster = R.compose(
  isNotNil,
  R.prop("poster_path")
);

const createMoviesElements = R.compose(
  R.map(createElement),
  R.map(createMovieTemplate),
  R.filter(hasPoster)
);

// createElementFromData :: (String -> HTMLElement) -> (Object -> String) -> Object -> HTMLElement
const createElementFromData = R.curry(function(
  createElement,
  createTemplate,
  data
) {
  const movieDetailTemplate = createTemplate(data);
  return createElement(movieDetailTemplate);
});

// createMovieNotFoundElement :: Object -> HTMLElement
const createMovieNotFoundElement = createElementFromData(
  createElement,
  createMovieNotFoundTemplate
);

// createMovieElement :: Movie -> HTMLElement
const createMovieElement = createElementFromData(
  createElement,
  createMovieDetailsTemplate
);

// createFavoriteMovieElement :: FavoriteMovie -> HTMLElement
const createFavoriteMovieElement = createElementFromData(
  createElement,
  createFavoriteMovieTemplate(ratingsOptions)
);

const searchHasResults = R.compose(
  R.lt(0),
  R.prop("total_results")
);
const createElementsFromResults = R.compose(
  createMoviesElements,
  R.prop("results")
);
const createArrayWithNotFound = R.always([createMovieNotFoundElement({})]);

const processSearchResponse = R.compose(
  R.forEach(appendElementToParent("foundMovies")),
  R.ifElse(
    searchHasResults,
    createElementsFromResults,
    createArrayWithNotFound
  ),
  R.tap(() => clearElement("foundMovies"))
);

function displayFavoriteMovies(favorites) {
  clearElement("favorites");
  Object.keys(favorites)
    .map(movieId => createFavoriteMovieElement(favorites[movieId]))
    .forEach(e => appendElementToParent("favorites", e));
}

function displayMovieDetails(movie) {
  const element = createMovieElement(movie);
  addElementToBody(isElementOnPage, removeElement, element);
}

const createGenresTemplate = R.compose(
  R.join(""),
  R.map(genre => `<li>${genre.name}</li>`)
);

function createMovieTemplate(movie) {
  return `
    <div class="movie" data-movie-id="${movie.id}">
      <p><strong>${movie.original_title}</strong></p>
      <img src="https://image.tmdb.org/t/p/w185${movie.poster_path}" />
      <p>
        <em>Year</em>: ${movie.release_date.substring(0, 4)}
      </p>
    </div>
  `;
}

function createMovieDetailsTemplate(movie) {
  return `
    <div class="movie-detail" data-movie-id="${movie.id}">
      <p><strong>${movie.original_title}</strong></p>
      <img src="https://image.tmdb.org/t/p/w185${movie.poster_path}" />
      <p>
        <em>Genres:</em>
        <ul>
          ${createGenresTemplate(movie.genres)}
        </ul>
      </p>
      <p>
        <em>Year</em>: ${movie.release_date.substring(0, 4)}
      </p>
      <p>
        <em>Rating:</em> ${movie.vote_average}
      </p>
      <p>
        <button class="btn-close">Close</button> 
        <button class="btn-favorite" 
          data-movie-title="${movie.title}" data-movie-id="${movie.id}">
            Add to favorites
        </button>
      </p>
    </div>
  `;
}

function createMovieNotFoundTemplate() {
  return `<strong>I'm sorry, we could not found the movie you were looking for<strong>`;
}

// handleEvent :: String -> String -> (a -> *) -> *`
const handleEvent = R.curry((eventName, target, callback) => {
  $(document).on(eventName, target, callback);
});

const onClick = handleEvent("click");

// getJson :: (Event -> String) -> (a -> *) -> Event -> *
const getJson = R.curry((urlBuilder, processResult, e) => {
  $.getJSON(urlBuilder(e))
    .done(processResult)
    .fail(err => log("Error when search for movies:", err));
});

// getDataAttrValue :: String -> HTMLElement -> a
const getDataAttrValue = R.curry((attr, el) => {
  return $(el).data(attr);
});

// getClosestMovie :: HTMLElement -> HTMLElement
function getClosestMovie(el) {
  return $(el).closest(".movie");
}

// fadeOut :: HTMLElement -> *
function fadeOut(el) {
  $(el)
    .closest("div")
    .animate({ opacity: 0 }, 300, function() {
      $(el).remove();
    });
}

// getValue :: String -> String
function getValue(id) {
  return $(`#${id}`).val();
}

// getMovieId :: HTMLElement -> a
const getMovieId = getDataAttrValue("movie-id");

// findMovieId :: HTMLElement -> String
const findMovieId = R.compose(
  getMovieId,
  getClosestMovie
);

// movieDetailsUrl :: (HTMLElement -> String) -> String -> Event -> String
const movieDetailsUrl = R.curry((findMovieId, apiKey, e) => {
  return `https://api.themoviedb.org/3/movie/${findMovieId(
    e.target
  )}?api_key=${apiKey}`;
});
// getMoviesDetails :: Event -> *
const getMoviesDetails = getJson(
  movieDetailsUrl(findMovieId, apiKey),
  displayMovieDetails
);
onClick(".movie img, .movie p", function(e) {
  e.preventDefault();
  getMoviesDetails(e);
});

// searchUrl :: (String -> String) -> String -> Event -> String
const searchUrl = R.curry((getValue, apiKey, e) => {
  return `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${getValue(
    "search"
  )}`;
});
// searchForMovies :: Event -> *
const searchForMovies = getJson(
  searchUrl(getValue, apiKey),
  processSearchResponse
);
const isNotEmpty = R.compose(
  R.not,
  R.isEmpty
);
window.searchIfNotEmpty = R.ifElse(
  isNotEmpty,
  searchForMovies,
  log("a search term should be provided")
);

onClick(".btn-close", function() {
  fadeOut(this);
});

function addMovieToFavorites(moviesService, movieId, title) {
  if (!moviesService.loadSavedMovies()[movieId]) {
    moviesService.addFavorite(movieId, title);
  }
}

onClick(".btn-favorite", function() {
  addMovieToFavorites(
    userMoviesService,
    getMovieId(this),
    getDataAttrValue("movie-title", this)
  );
  displayFavoriteMovies(userMoviesService.loadSavedMovies());
  fadeOut(this);
});

onClick(".remove-favorite", function(e) {
  e.preventDefault();
  const movieId = getMovieId(this);
  userMoviesService.removeFavorite(movieId);
  displayFavoriteMovies(userMoviesService.loadSavedMovies());
});

handleEvent("change", ".movie-rating", function() {
  const movieId = getMovieId(this);
  var rating = $(this).val();
  userMoviesService.rateMovie(movieId, rating);
});

function clearElement(id) {
  document.getElementById(id).innerHTML = "";
}

function createElement(template) {
  const el = document.createElement("template");
  el.innerHTML = template;
  return el;
}

function addElementToBody(isElementOnPage, removeElement, el) {
  if (isElementOnPage("movie-detail")) {
    removeElement("movie-detail");
  }
  document.body.appendChild(el.content.firstElementChild);
  $(".movie-detail").animate(
    {
      opacity: 1
    },
    300
  );
}

function removeElement(className) {
  document.getElementsByClassName(className)[0].remove();
}

function isElementOnPage(className) {
  return document.getElementsByClassName(className).length > 0;
}

window.onload = function() {
  displayFavoriteMovies(userMoviesService.loadSavedMovies());
};
