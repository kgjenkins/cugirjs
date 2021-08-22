/* global $ setupConfig */
import { Sift } from './sift.mjs'

window.cssVar = Sift.cssVar
window.Sift = Sift

$(document).ready(function () {
  const s = new Sift({
    config: setupConfig(),
    dataSource: 'data/cugir.json',
    resultsDiv: 'left-panel',
    mapDiv: 'map'
  })
  window.s = s
  waitForData()
  $(document).on('click', 'img#logo', home)
  $(document).on('click', '#resetButton', home)
  $(document).on('change', '#limitToMap', updateMapLimit)
  $(document).on('submit', 'form#search', function (e) {
    const q = $('#q').val()
    const qbounds = s.map.leaflet.getBounds()
    s.search(q, qbounds)
    e.preventDefault()
  })
  window.onhashchange = function () {
    // determine if browser back/forward buttons are clicked and if so...
    // interpretHash()
  }
})

// TODO have the UI set something like s.config.limitToMap
function updateMapLimit() {
  s.config.limitToMap = $('#limitToMap').is(':checked')
}

function waitForData () {
  if (!s.data) {
    window.setTimeout(function () { waitForData() }, 100)
  } else {
    interpretHash()
  }
}

function interpretHash () {
  const hash = window.location.hash
  if (hash) {
    // search for whatever is after the #
    s.search(s.unescapeHash(hash.slice(1)))
  } else {
    home()
  }
}

function home () {
  s.go('', 'CUGIRjs home')
  $('#q').val('')
  $('#summary').html('')
  s.map.clear()
  s.map.leaflet.fitBounds(s.config.homeBounds)
  $('#left-panel').html(
    '<div class="home">' +
      '<h1>Welcome to CUGIR!</h1>' +
      '<p>Explore and discover New York State geospatial data:</p>' +
      '<ul id="categories"></ul>' +
      '<p class="alert">' +
      'This is an EXPERIMENTAL javascript interface to <a href="https://cugir.library.cornell.edu/">CUGIR</a>.' +
      '</p>' +
    '</div>'
  )
  // list all categories (and the number of datasets for each)
  const catstat = s.stats(s.data, 'category')
  let categories = Object.keys(catstat)
  categories = categories.sort(function (a, b) {
    if (a < b) return -1
    else if (a > b) return 1
    else return 0
  })
  for (let i = 0; i < categories.length; i++) {
    const li = $('<li>').appendTo('#categories')
    $('<a>')
      .text(categories[i])
      .attr('href', '#category="' + categories[i] + '"')
      .click(Sift._clickLink)
      .appendTo(li)
    $('<span class="count">').html('&nbsp;(' + catstat[categories[i]] + ') ')
      .appendTo(li)
  }
}
