// Sift - a search interface for geospatial datasets

/* global $ L */

import { filter } from './lib/json-filter.mjs'

// rewrite as
export class Sift {
  constructor(options) {
    this.x = options.x
    ///etc
  }
  get myattribute() {
    return this.myattribute()
  }
  mymethod() {
    return whatever
  }
}

// and then call from cugir.js as
// const s = new Sift(options)

export function Sift (options) {
  // TODO check for required options:
  // config, dataSource, resultsDiv, mapDiv
  this.config = options.config
  _loadData(this, options.dataSource)
  this.results = options.resultsDiv
  this.map = _setupMap(this)
  this.search = _search
  this.rank = _rank
  this.showResult = _showResult
  this.go = _go
  this.home = _home
  this.unescapeHash = _unescapeHash
  this.escapeForHash = _escapeForHash
  this.stats = _stats
  this.itemDetails = _itemDetails
  this.downloadSection = _downloadSection
  this.categories = _categories
  waitForData(this)
}

$(document).on('keydown', _listenForKeys)
$(document).on('mouseover', '#results > li', _mouseoverResultItem)
$(document).on('mouseout', '#results > li', _mouseoutResultItem)
$(document).on('click', '#results > li', _clickResultItem)
$(document).on('click', 'button.more', _showMore)
$(document).on('click', 'button.prev', _clickPrevButton)
$(document).on('click', 'button.next', _clickNextButton)
$(document).on('click', '#backToSearch', _backToSearch)
$(document).on('click', 'a', _clickLink)

// indexmap actions
$(document).on('click', '#attr button.close', _clearSelections)
$(document).on('click', '#download-all', _downloadAll)

function waitForData (s) {
  if (!s.data) {
    window.setTimeout(function () { waitForData(s) }, 100)
  } else {
    interpretHash(s)
  }
}

function interpretHash (s) {
  const hash = window.location.hash
  if (hash) {
    // search for whatever is after the #
    s.search(s.unescapeHash(hash.slice(1)))
  } else {
    s.home()
  }
}

function _loadData (s, datasource) {
  $.ajax({
    url: datasource,
    dataType: 'json',
    success: function (json, status, xhr) {
      s.data = []
      const docs = json.response.docs
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        s.data.push(s.config.solr2sift(doc))
      }
    },
    error: function (xhr, status, error) {
      console.log(xhr)
      console.log(status)
      console.log(error)
    }
  })
}

function _setupMap (s) {
  const map = {}
  map.leaflet = L.map('map')

  // zoom to NYS
  map.leaflet.fitBounds(s.config.homeBounds)

  // add basemap using colorFilter to enhance/balance coloration
  if (cssVar('--dark')) {
    L.tileLayer.colorFilter(s.config.basemapDark, {
      isBasemap: true,
      maxZoom: 21,
      opacity: 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
      filter: [
        'brightness:250%',
        'contrast:100%'
      ]
    }).addTo(map.leaflet)
  } else {
    L.tileLayer.colorFilter(s.config.basemap, {
      isBasemap: true,
      maxZoom: 21,
      opacity: 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/location-data-services/basemaps/">Carto</a>',
      filter: [
        'brightness:75%',
        'contrast:200%',
        'saturate:200%'
      ]
    }).addTo(map.leaflet)
  }
  map.leaflet.on('click', _clickMap)

  map.clear = function () {
    this.leaflet.eachLayer(function (layer) {
      if (!layer.options.isBasemap) layer.remove()
    })
    $('#attr').remove()
    $('#zoom').remove()
  }

  return map
}

function _go (hash, title) {
  window.location.hash = hash
  document.title = title
}

function _search (q, qbounds) {
  // search for query q within the query bounds

  // remove superfluous quotes around single words
  q = q.replace(/"(\w+)"/g, '$1')

  this.go(this.escapeForHash(q), 'search for ' + q)
  $('#q').val(q)
  let results = filter(this.data, q)
  results = this.rank(results, qbounds)
  $('#' + this.results).html(
    '<div id="summary"></div>' +
    '<div id="body"></div>'
  )
  this.map.clear()
  let bounds
  const nav = $('<div id="nav">').text(Object.keys(results).length + ' matches')
  if (q) {
    nav.append(' for ')
    $('<a>')
      .addClass('q')
      .text(q)
      .attr('href', '#' + q)
      .click(this.backToSearch)
      .appendTo(nav)
  }
  nav.prependTo('#summary')
  const ul =
    $('<ul id="results">')
      .data('q', q)
      .data('qbounds', qbounds)
  for (const i in results) {
    const item = results[i]
    if (!bounds) {
      bounds = L.latLngBounds(item.bbox)
    }
    bounds.extend(item.bbox)
    this.showResult(item).prependTo(ul)
  }
  ul.appendTo('#body')
  $('html').scrollTop(0)
  if ($('#results li').length === 1) {
    // expand details if only one item
    $('#results li').click()
    return
  }
  if (bounds) {
    const zoomButton = $('<button id="zoom">')
      .text('Zoom to search results')
      .click(function () {
        s.map.leaflet.fitBounds(bounds, { animate: true, duration: 1 })
      })
      .prependTo('#right-panel')
    if ($('#limitToMap').val()) {
      zoomButton.click()
    }
  }
}

function _rank (results, bounds) {
  if (!bounds) {
    bounds = this.map.leaflet.getBounds()
  }
  const mx1 = bounds.getWest()
  const my1 = bounds.getSouth()
  const mx2 = bounds.getEast()
  const my2 = bounds.getNorth()
  const mapArea = (mx2 - mx1) * (my2 - my1)
  const resultList = []
  for (const i in results) {
    const item = results[i]
    const ix1 = item.bbox[0][1]
    const iy1 = item.bbox[0][0]
    const ix2 = item.bbox[1][1]
    const iy2 = item.bbox[1][0]
    const itemArea = (ix2 - ix1) * (iy2 - iy1)
    const intersectX = Math.min(mx2, ix2) - Math.max(mx1, ix1)
    const intersectY = Math.min(my2, iy2) - Math.max(my1, iy1)
    let intersectArea = 0
    if (intersectX < 0 || intersectY < 0) {
      // no overlap

      // omit from results?
      if (this.config.limitToMap) continue

      // rank by distance to map bounds
      item._spatialscore = -1 * Math.sqrt(Math.pow(intersectX, 2) + Math.pow(intersectY, 2))
    } else {
      intersectArea = intersectX * intersectY
      item._spatialscore = intersectArea / mapArea * intersectArea / itemArea
    }
    resultList.push(item)
  }
  // sort lowest first
  resultList.sort(function (a, b) {
    return a._spatialscore > b._spatialscore ? 1 : -1
  })
  return resultList
}

function _showResult (item) {
  const li = $('<li>').data('item', item)
  // $('<div>').text(item._spatialscore).appendTo(li);
  $('<a class="title">')
    .text(item.title)
    .attr('href', '#id=' + item.id)
    .appendTo(li)
  $('<div class="brief">').text(item.description).appendTo(li)
  this.itemDetails(item).appendTo(li)
  $('<span>').text(item.creator + '. ').prependTo(li.find('.description'))
  const bboxlayer = _renderItemBbox(item)
  bboxlayer.options.li = li
  li.data('bbox', bboxlayer)
  return li
}

function _renderItemBbox (item) {
  // add bbox to map
  const layer = L.rectangle(item.bbox, s.config.mapStyles.bbox).addTo(s.map.leaflet)
  return layer
}

function _itemDetails (item) {
  const details = $('<div class="details">')
  const table = $('<table>').appendTo(details)
  // TODO move to config,
  // and, after this list, include any other fields found in the item
  const properties = [
    'author',
    'description',
    'collection',
    'place',
    'category',
    'subject',
    'year',
    'filesize'
  ]
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i]
    const v = item[p]
    if (!v) continue
    const tr = $('<tr>').appendTo(table)
    $('<th>').text(p).appendTo(tr)
    const td = $('<td>').html(_linkify(p, v)).appendTo(tr)
    if (p === 'wms' || p === 'wfs') {
      td.append(' (layerid=' + item.layerid + ')')
    }
  }

  // METADATA
  let tr = $('<tr>').appendTo(table)
  $('<th>').text('more details').appendTo(tr)
  let td = $('<td>').appendTo(tr)
  $('<a>').attr('href', item.metadata).attr('target', '_blank').text('metadata').appendTo(td)

  // DOWNLOAD
  tr = $('<tr>').prependTo(table)
  $('<th>').text('download').appendTo(tr)
  td = $('<td>').appendTo(tr)
  td.append(this.downloadSection(item))

  // ALERT IF NO WMS IMAGE IS AVAILABLE
  if (!item.wms && !item.openindexmaps) {
    tr = $('<tr class="alert">').prependTo(table)
    $('<th>').text('note').appendTo(tr)
    $('<td>').text('Map previews are not available for the ' + item.format + ' file format.')
      .appendTo(tr)
  }

  return details
}

function _downloadSection (item) {
  const div = $('<div class="downloads">')
  const isIndexMap = item.category.indexOf('index map') > -1

  // main download file
  let format = item.format
  if (format.slice(-4) !== 'file') {
    format += ' file'
  }
  if (isIndexMap) {
    format += ' (index map)'
  }
  $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', item.download)
    .text(format)
    .appendTo(div)
  div.append(item.filesize + ' ')

  if (isIndexMap) {
    $('<p class="alert">')
      .text('This is an index map.  Please select features on the map to get the download links for the actual data.')
      .appendTo(div)
    $('<div class="allclear">').appendTo(div)
    $('<ul class="subsets">').appendTo(div)
  }

  // addl_downloads
  if (Object.keys(item.addl_downloads).length > 0) {
    div.append('<br>')
    for (const k in item.addl_downloads) {
      $('<a>')
        .addClass('download')
        .attr('target', '_blank')
        .attr('href', item.addl_downloads[k])
        .text(k)
        .appendTo(div)
    }
  }

  return div
}

function _siftMapResults () {
  //
}

function _siftMapDetails () {
  //
}

function _siftMapIndexSelection () {
  //
}

function _linkify (p, v) {
  // linkify specific fields
  if (s.config.linkify.indexOf(p) > -1) {
    // make sure v is an array
    if (!Array.isArray(v)) {
      v = [v]
    }
    const div = $('<div>')
    let count = 0
    for (let i = 0; i < v.length; i++) {
      const vi = v[i]
      if (count++) {
        div.append(', ')
      }
      $('<a>')
        .text(vi)
        .attr('href', '#' + p + '="' + vi + '"')
        .appendTo(div)
    }
    return div
  } else if (Array.isArray(v)) {
    return v.join(', ')
  }

  let max = s.config.moreLength
  if (typeof (v) === 'string' && v.length > (max * 1.3)) {
    // adjust max to chop at a space
    max = v.indexOf(' ', max - 16)
    const more = v.substr(max)
    v = v.substr(0, max) +
      "<button class='more'>more</button>" +
      "<span class='more'>" + more + '<span>'
  }
  return v
}

function _clickLink (e) {
  // intercept hash links (like #category=transportation)
  const hash = e.target.hash
  if (hash.length > 0) {
    // stop regular link handler
    // (but note we don't e.stopPropagation() because we want clickResultItem)
    e.preventDefault()
    if (!e.target.classList.contains('title')) {
      s.search(_unescapeHash(hash.substr(1)))
    }
  }
}

Sift.cssVar = function (name) {
  const body = window.getComputedStyle(document.querySelector('body'))
  return body.getPropertyValue(name)
}

function _stats (data, property) {
  const seen = {}
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    const value = item[property]
    for (let j = 0; j < value.length; j++) {
      const valuej = value[j]
      if (typeof seen[valuej] !== 'undefined') {
        seen[valuej] += 1
      } else {
        seen[valuej] = 1
      }
    }
  }
  return seen
}

function _showMore (e) {
  $(e.target).hide()
  $(e.target).next().show()
}

function _unescapeHash (h) {
  return unescape(h).replace(/\+/g, ' ')
}

function _escapeForHash (q) {
  const hash = escape(q.replace(/\//g, '//'))
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':')
    .replace(/%3D/g, '=')
  return hash
}

function _mouseoverResultItem (e) {
  const item = $(e.currentTarget)
  if ($('#results li.active').length > 0) {
    // ignore mouseover if any item is active (i.e. in detail view)
    return
  }
  $('#results li.hover').each(function (i, olditem) {
    olditem = $(olditem)
    olditem.removeClass('hover')
    const bbox = olditem.data('bbox')
    if (bbox) {
      bbox.setStyle(s.config.mapStyles.bbox)
    }
  })
  item.addClass('hover')
  const bbox = item.data('bbox')
  if (bbox) {
    bbox.setStyle(s.config.mapStyles.bboxHighlight).bringToFront()
  }
}

function _mouseoutResultItem (e) {
  const item = $(e.currentTarget)
  const bbox = item.data('bbox')
  if (bbox) {
    bbox.setStyle(s.config.mapStyles.bbox)
  }
}

function _backToSearch () {
  const q = $('#results').data('q')
  const qbounds = $('#results').data('qbounds')
  const scroll = $('#results').data('scroll') - 120
  $('#q').val(q)
  search(q, qbounds)
  $('html').scrollTop(scroll)
}

function _clickResultItem (e) {
  if (e.ctrlKey) {
    // ctrl-click should open the link in a new window
    const item = $(e.currentTarget).data('item')
    window.open('#id=' + item.id)
    return false
  }

  // check that we are not already viewing this item
  if ($(e.currentTarget).hasClass('active')) {
    return
  }

  // deactivate the item and remove any download subsets
  $('#results li.active')
    .removeClass('active')
    .find('.subsets, .allclear').html('')

  // activate the clicked item and show it
  const li = $(e.currentTarget).addClass('active').show()

  // remember current scroll position
  $('#results').data('scroll', li.offset().top)

  // go to top of page
  $('html').scrollTop(0)
  const item = li.data('item')

  // add cugir id to the URL hash
  _go('id=' + item.id, item.title)

  // clear the map and hide all other results
  s.map.clear()
  $('#results li:not(.active)').hide()

  const nav = $('#nav')

  // $('<button id="backToSearch">')
  //  .text('Back to Search')
  //  .attr('href', '#'+ escapeForHash($('#results').data('q')))
  //  .appendTo(summary);

  $('.prev').remove()
  $('<button class="prev">')
    .text('« previous')
    .appendTo(nav)

  // remove any existing number
  $('.num').remove()

  // add number of current result
  const num = $('#results li').index(li) + 1
  $('<span class="num">').text(num + ' of ').prependTo('#nav')

  $('.next').remove()
  $('<button class="next">')
    .text('next »')
    .appendTo(nav)

  s.map.leaflet.fitBounds(item.bbox, { animate: true, duration: 1, padding: [32, 32] })
  if (item.wms) {
    li.data('layer', wmsLayer(item))
  } else if (item.openindexmaps) {
    li.data('layer', openindexmapsLayer(item))
  } else {
    const bboxlayer = _renderItemBbox(item)
    bboxlayer.setStyle(s.config.mapStyles.unavailable)
  }
}

function wmsLayer (item) {
  const url = item.wms
  const options = {
    layers: item.layerid,
    format: 'image/png',
    transparent: true,
    tiled: true,
    maxZoom: 21 // default 18 is not enough
  }
  if (cssVar('--dark') && url.match(/cugir/) && item.geom_type.match(/point|line|polygon/i)) {
    options.styles = 'darkmode-' + item.geom_type
  }
  const layer = L.tileLayer.wms(url, options)
  layer.addTo(s.map.leaflet).bringToFront()
  return layer
}

function openindexmapsLayer (item) {
  const url = item.openindexmaps
  const layer = new L.GeoJSON.AJAX(url, {
    style: s.config.mapStyles.indexmap,
    onEachFeature: function (feature, layer) {
      if (feature.properties.available === false) {
        layer.setStyle(s.config.mapStyles.unavailable)
      }
      feature.layer = layer
      layer.bindTooltip(
        feature.properties.label || feature.properties.title,
        { sticky: true, direction: 'top' }
      )
    }
  })
  layer.addTo(s.map.leaflet).bringToFront()
  return layer
}

function _clickPrevButton () {
  const prev = $('#results li.active').prev()
  if (prev) {
    prev.click()
  }
}

function _clickNextButton () {
  const next = $('#results li.active').next()
  if (next) {
    next.click()
  }
}

function _clickMap (e) {
  // Does the map show an active item?
  const active = $('#results li.active')
  if (active.length > 0) {
    // Is it openindexmap, raster, or vector?
    if (active.data('item').openindexmaps) {
      clickIndexMap(e)
    } else if (active.data('item').geom_type === 'Raster') {
      clickRasterMap(e)
    } else {
      clickVectorMap(e)
    }
  } else if ($('#results li').length > 0) {
    // Does the map show result bboxes?
    clickResultsMap(e)
  }
}

function clickResultsMap (e) {
  // forget about any previously-clicked item
  const olditem = $('#results li.hover').removeClass('hover')
  if (olditem.length > 0) {
    olditem.data('bbox').setStyle(s.config.mapStyles.bbox)
  }

  // highlight the clicked bbox and corresponding item
  const layer = map.getLayerAt(e.layerPoint)
  const li = layer.options.li.mouseover()
  $('html').scrollTop(li.offset().top - 240)
  // move to back so that other results can be clicked
  layer.bringToBack()
}

function clickIndexMap (e) {
  const active = $('#results li.active')

  // get the clicked feature properties
  const features = leafletPip.pointInLayer(e.latlng, active.data('layer'))
  if (features.length === 0) {
    // no features found at the clicked point
    return false
  }
  const feature = features[0].feature
  showAttributes(feature.properties)

  const subsets = $('#results li.active .subsets')
  const allclear = $('#results li.active .allclear')
  if (!(feature.properties.available && feature.properties.downloadUrl)) {
    return
  }
  if (feature.selection) {
    // deselect this feature
    feature.selection.remove()
    feature.download.remove()
    delete feature.selection
  } else {
    // highlight feature
    const layer = L.geoJSON(feature, {
      // display points as little circles
      pointToLayer: function (point, latlng) {
        return L.circleMarker(latlng, { color: cssVar('--map-feature-highlight-color') })
      },
      style: s.config.mapStyles.indexmapSelected,
      isSelection: true
    }).addTo(s.map.leaflet)
    feature.selection = layer

    // keep track of the download button so we can remove it later
    // if the feature is clicked again
    feature.download = subsetDownload(feature.properties)

    // add download button
    subsets.append(feature.download)
  }

  allclear.html('')
  if (subsets.children().length > 0) {
    $('<button id="clear-subsets">Clear selection</button>')
      .appendTo(allclear)
      .on('click', clearSelections)
  }
  if (subsets.children().length > 1) {
    allclear.append('<button id="download-all">Download all selected subsets</button>')
  }
}

function subsetDownload (p) {
  let name = p.label
  if (!name) name = p.title
  const a = $('<a>')
    .addClass('download')
    .attr('target', '_blank')
    .attr('href', p.downloadUrl)
    .text(name)
  return $('<li>').append(a)
}

function _downloadAll () {
  $('.subsets .download').each(function (i, link) {
    const url = $(link).attr('href')
    // wait 500ms between downloads to keep the browser happy
    setTimeout(function () { window.location = url }, 500 * i)
  })
}

function _clearSelections () {
  // remove everything from downloads section
  $('.allclear, .subsets').html('')
  // remove selections from map
  map.eachLayer(function (layer) {
    if (layer.options.isSelection) {
      if (layer.feature && layer.feature.selection) {
        layer.feature.selection.remove()
        delete layer.feature.selection
      }
      layer.remove()
    }
  })
  // remove attributes too
  $('#attr').remove()
}

function clickVectorMap (e) {
  const active = $('#results li.active')
  const item = active.data('item')

  // calc generous bbox for the clicked point (+/- 3 pixels)
  // otherwise it is difficult to click a point feature
  const bounds = map.getBounds()
  const pixelsize = (bounds._northEast.lat - bounds._southWest.lat) / map.getSize().y
  const x1 = e.latlng.lng - pixelsize * 3
  const x2 = e.latlng.lng + pixelsize * 3
  const y1 = e.latlng.lat - pixelsize * 3
  const y2 = e.latlng.lat + pixelsize * 3
  const params = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: item.layerid,
    srs: 'EPSG:4326',
    bbox: [y1, x1, y2, x2].join(','),
    outputFormat: 'json'
  }
  const url = item.wfs + L.Util.getParamString(params)

  /* TODO try WMS if WFS fails
  params = {
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: item.layerid,
    query_layers: item.layerid,
    srs: 'EPSG:4326',
    bbox: [x1, y1, x2, y2].join(','),
    x: 3,
    y: 3,
    width: 7,
    height: 7,
    info_format: 'application/json'
  }
  url = item.wms + L.Util.getParamString(params)
  */

  $.ajax({
    url: url,
    dataType: 'json',
    success: function (data, status, xhr) {
      if (data.features.length === 0) {
        // no features found
        return
      }

      // WFS bbox query returns potential matches (based on feature bbox)
      // so check for real point-in-polygon matches
      let match
      if (data.features[0].geometry.type.indexOf('Polygon') > -1) {
        const matches = leafletPip.pointInLayer(e.latlng, L.geoJSON(data), true)
        if (matches.length === 0) return
        // use first match only
        match = matches[0].feature
      } else {
        // use first match only
        // TODO show multiple matches
        match = data.features[0]
      }
      const properties = match.properties

      // remove any other selected features
      // since we only look at one feature's attributes at a time
      map.eachLayer(function (layer) {
        if (layer.options.isSelection) {
          layer.remove()
        }
      })

      // highlight feature and show attributes
      L.geoJSON(match, {
        // display any points as little circles
        pointToLayer: function (point, latlng) {
          return L.circleMarker(latlng, { color: cssVar('--map-feature-highlight-color') })
        },
        style: s.config.mapStyles.featureHighlight,
        isSelection: true
      }).addTo(s.map.leaflet)
      showAttributes(properties)
    },
    error: function (xhr, status, error) {
      console.log(xhr)
      console.log(status)
      console.log(error)
    }
  })
}

function clickRasterMap (e) {
  const item = $('#results li.active').data('item')
  const bounds = map.getBounds()
  const x1 = bounds._southWest.lng
  const x2 = bounds._northEast.lng
  const y1 = bounds._southWest.lat
  const y2 = bounds._northEast.lat
  const size = map.getSize()
  const params = {
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: 'cugir:' + item.layerid,
    query_layers: 'cugir:' + item.layerid,
    srs: 'EPSG:4326',
    bbox: [x1, y1, x2, y2].join(','),
    width: size.x,
    height: size.y,
    info_format: 'application/json',
    x: parseInt(e.containerPoint.x),
    y: parseInt(e.containerPoint.y)
  }
  const url = item.wms + L.Util.getParamString(params)
  // url = 'https://alteriseculo.com/proxy/?url=' + encodeURIComponent(url)
  $.ajax({
    url: url,
    dataType: 'json',
    success: function (data, status, xhr) {
      // remove any existing highlighted point
      map.eachLayer(function (layer) {
        if (layer.options.isSelection) {
          layer.remove()
        }
      })
      // show feature and attributes
      const layer = L.circleMarker(e.latlng, {
        style: s.config.mapStyles.featureHighlight,
        isSelection: true,
        color: cssVar('--map-feature-highlight-color')
      }).addTo(s.map.leaflet)
      const properties = data.features[0].properties
      const value = properties.GRAY_INDEX || properties.PALETTE_INDEX
      layer.bindTooltip('' + value, { permanent: true })
    },
    error: function (xhr, status, error) {
      console.log(xhr)
      console.log(status)
      console.log(error)
    }
  })
}

function showAttributes (properties) {
  $('#attr').remove()
  const info = $('<div id="attr">').appendTo('body')
  const table = $('<table>')
    .html('<tr class="head"><th colspan="2">Attributes<button class="close">X</button></th></tr>')
    .appendTo(info)
  // show all properties
  // custom view for new openindexmaps w/thumbnail, etc
  for (const p in properties) {
    const tr = $('<tr>').appendTo(table)
    $('<th>').text(p).appendTo(tr)
    let v = properties[p]
    let link = false
    if (p.match(/^thumb(nail)?Url$/)) {
      // display thumbnails
      v = $('<img>').attr('src', v)
    } else if (typeof (v) === 'string' && (v.startsWith('http') || v.startsWith('ftp'))) {
      // linkify URLs
      link = true
      v = $('<a>')
        .attr('href', v)
        .attr('target', '_blank')
        .text(v)
    }
    if (v === false) {
      v = 'false'
    }
    const td = $('<td>').html(v).appendTo(tr)
    if (link) {
      td.addClass('url')
    }
  }
}

function _listenForKeys (e) {
  if (e.key === 'Escape') {
    _clearSelections()
  } else if (e.key === 'PageDown') {
    _clickNextButton()
  } else if (e.key === 'PageUp') {
    _clickPrevButton()
  } else if (e.key === 'Enter') {
    $('#results li.hover').click()
  }
}

function _categories () {
  // return a <ul> listing all categories (and number of datasets in each)
  const div = $('<ul id="categories">')
  const catstat = this.stats(this.data, 'category')
  let categories = Object.keys(catstat)
  categories = categories.sort(function (a, b) {
    if (a < b) return -1
    else if (a > b) return 1
    else return 0
  })
  for (let i = 0; i < categories.length; i++) {
    const li = $('<li>').appendTo(div)
    $('<a>')
      .text(categories[i])
      .attr('href', '#category="' + categories[i] + '"')
      .appendTo(li)
    $('<span class="count">').html('&nbsp;(' + catstat[categories[i]] + ') ')
      .appendTo(li)
  }
  return div
}

function _home () {
  s.go('', 'CUGIRjs home')
  $('#q').val('')
  $('#summary').html('')
  s.map.clear()
  s.map.leaflet.fitBounds(s.config.homeBounds)
  $('#left-panel').html(s.config.homeHtml)
  $('.home')
    .append(s.categories())
}
