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

  // assign s to the window so that it is available in dev tools
  window.s = s

  $(document).on('click', 'img#logo', s.home)
  $(document).on('click', '#resetButton', s.home)
  $(document).on('change', '#limitToMap', function () {
    s.config.limitToMap = $('#limitToMap').is(':checked')
  })

  $(document).on('submit', 'form#search', function (e) {
    const q = $('#q').val()
    const qbounds = s.map.leaflet.getBounds()
    s.search(q, qbounds)
    e.preventDefault()
  })

  window.onhashchange = function () {
    // console.log(window.location.hash)
    // determine if browser back/forward buttons are clicked and if so...
    // interpretHash()
    // maybe look at the leaflet history plugin for ideas
  }
})
