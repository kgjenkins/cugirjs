// Sift - a search interface for geospatial datasets

/* global $ L */

function Sift (options) {
  // TODO check for required options:
  // config, dataSource, resultsDiv, mapDiv
  this.config = options.config
  _loadData(this, options.dataSource)
  this.results = options.resultsDiv
  this.map = _setupMap(this)
  this.search = _search
  this.rank = _rank
  this.showResults = _showResults
  this.showDetauls = _showDetails
  this.stats = _stats
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

function _clickMap (e) {
  console.log('click', e)
}

function _search (q, qbounds) {
  // search for query q within the query bounds

  // remove superfluous quotes around single words
  q = q.replace(/"(\w+)"/g, '$1')

  go(escapeForHash(q), 'search for ' + q)
  $('#q').val(q)
  let results = filter(this.data, q)
  results = s.rank(results, qbounds)
  $('#'+s.resultsDiv).html(
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
      .click(backToSearch)
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
    _showResult(item).prependTo(ul)
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
  _itemDetails(item).appendTo(li)
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

function _showResults () {
  // summary, result list, map
  _siftMapResults()
}

function _showDetails () {
  _siftMapDetails()
}

function _itemDetails (item) {
  const details = $('<div class="details">')
  const table = $('<table>').appendTo(details)
  // TODO after this list, include any other fields found in the item
  const properties = [
    'author',
    'year',
    'description',
    'collection',
    'place',
    'category',
    'subject',
    'wms',
    'wfs',
    'institution'
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
  td.append(downloadSection(item))

  // ALERT IF NO WMS IMAGE IS AVAILABLE
  if (!item.wms && !item.openindexmaps) {
    tr = $('<tr class="alert">').prependTo(table)
    $('<th>').text('note').appendTo(tr)
    $('<td>').text('Map previews are not available for the ' + item.format + ' file format.')
      .appendTo(tr)
  }

  return details
}

function downloadSection (item) {
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
        .click(_clickLink)
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
  // click a link with a hash href like #category=transportation
  const q = $(e.target).attr('href').substr(1)
  s.search(q)
  return false
}

function cssVar (name) {
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
