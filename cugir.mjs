/* global $ setupConfig */
// import { Sift } from './sift.mjs'
import { Siftc } from './siftc.mjs'

// let s
let sc
window.cssVar = Siftc.cssVar

$(document).ready(function () {
  /*
  s = new Sift({
    config: setupConfig(),
    dataSource: 'data/cugir.json',
    resultsDiv: 'left-panel',
    mapDiv: 'map'
  })
*/

  sc = new Siftc({
    config: setupConfig(),
    dataSource: 'data/cugir.json',
    resultsDiv: 'left-panel',
    mapDiv: 'map'
  })

  // assign s to the window so that it is available in dev tools
  // window.s = s
  window.sc = sc

  $(document).on('click', 'img#logo', e => sc.home())
  $(document).on('click', '#resetButton', e => sc.home())
  $(document).on('change', '#limitToMap', function () {
    s.config.limitToMap = $('#limitToMap').is(':checked')
  })

  $(document).on('submit', 'form#search', function (e) {
    const q = $('#q').val()
    const qbounds = s.map.leaflet.getBounds()
    s.search(q, qbounds)
    e.preventDefault()
  })

  return

  window.onhashchange = function () {
    // console.log(window.location.hash)
    // determine if browser back/forward buttons are clicked and if so...
    // interpretHash()
    // maybe look at the leaflet history plugin for ideas
  }
})
