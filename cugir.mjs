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
  // window.s = s
  window.s = s

  $(document).on('click', 'img#logo', e => s.home())
  $(document).on('click', '#resetButton', e => s.home())
  $(document).on('change', '#limitToMap', function () {
    s.config.limitToMap = $('#limitToMap').is(':checked')
  })

  $(document).on('submit', 'form#search', function (e) {
    e.preventDefault()
    const q = $('#q').val()
    const qbounds = s.map.leaflet.getBounds()
    s.search(q, qbounds)
  })

  window.onhashchange = function () {
    // console.log(window.location.hash)
    // determine if browser back/forward buttons are clicked and if so...
    // interpretHash()
    // maybe look at the leaflet history plugin for ideas
  }
})
