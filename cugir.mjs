/* global $ setupConfig */
import { Sift } from './sift.mjs'

let s
window.cssVar = Sift.cssVar

$(document).ready(function () {
  s = new Sift({
    config: setupConfig(),
    dataSource: 'data/cugir.json',
    resultsDiv: 'left-panel',
    mapDiv: 'map'
  })
  s.home = home

  // assign s to the window so that it is available in dev tools
  window.s = s

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
    // maybe look at the leaflet history plugin for ideas
  }
})

// TODO have the UI set something like s.config.limitToMap
function updateMapLimit () {
  s.config.limitToMap = $('#limitToMap').is(':checked')
}

function home () {
  s.go('', 'CUGIRjs home')
  $('#q').val('')
  $('#summary').html('')
  s.map.clear()
  s.map.leaflet.fitBounds(s.config.homeBounds)
  $('#left-panel').html(s.config.homeHtml)
  $('.home')
    .append(s.categories)
}
