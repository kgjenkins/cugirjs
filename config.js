/* global cssVar */

config = {

  basemap: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  basemap_dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',

  // link values of these fields to a search query
  linkify: [
    'collection',
    'category',
    'place',
    'author',
    'wms',
    'wfs'
  ],

  // field display will be limited to this many characters
  // (with a link to view 'more')
  moreLength: 500,

  mapStyles: {
    bbox: {
      color: cssVar('--map-bbox-color'),
      opacity: 0.3,
      weight: 1,
      fillColor: '#fff',
      fillOpacity: 0,
      isBbox: true
    },
    bboxHighlight: {
      color: cssVar('--map-bbox-highlight-color'),
      opacity: 1,
      weight: 4,
      fillColor: cssVar('--map-bbox-highlight-color'),
      fillOpacity: 0.2
    },
    featureHighlight: {
      color: cssVar('--map-feature-highlight-color'),
      opacity: 1,
      weight: 4,
      fillColor: cssVar('--map-feature-highlight-color'),
      fillOpacity: 0.4
    },
    indexmap: {
      color: cssVar('--map-indexmap-color'),
      opacity: 1,
      weight: 0.5,
      fillColor: cssVar('--map-indexmap-color'),
      fillOpacity: 0.3
    },
    unavailable: {
      color: cssVar('--map-indexmap-unavailable-color'),
      opacity: 1,
      weight: 0.5,
      fillColor: cssVar('--map-indexmap-unavailable-color'),
      fillOpacity: 0.3
    },
    indexmapSelected: {
      color: cssVar('--map-indexmap-selected-color'),
      opacity: 1,
      weight: 2,
      fillColor: cssVar('--map-indexmap-selected-color'),
      fillOpacity: 0.3
    }
  }
}
