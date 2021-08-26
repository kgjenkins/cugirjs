// Sift - a search interface for geospatial datasets

/* global $ L leafletPip */

import { filter } from './lib/json-filter.mjs'

export class Sift {
  constructor (options) {
    // TODO check for required options:
    // config, dataSource, resultsDiv, mapDiv
    this.config = options.config

    // TODO better way to wait for data to load? Promise?
    this._loadData(options.dataSource)

    this.results = options.resultsDiv

    this.setupMap()

    $(document).on('keydown', e => this.listenForKeys(e))
  }

  _loadData (datasource) {
    const that = this
    $.ajax({
      url: datasource,
      dataType: 'json',
      success: function (json, status, xhr) {
        that.data = []
        const docs = json.response.docs
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i]
          that.data.push(that.config.solr2sift(doc))
        }
        that.interpretHash()
      },
      error: function (xhr, status, error) {
        console.log(xhr)
        console.log(status)
        console.log(error)
      }
    })
  }

  interpretHash () {
    const hash = window.location.hash
    if (hash) {
      // search for whatever is after the #
      this.search(Sift.unescapeHash(hash.slice(1)))
    } else {
      this.home()
    }
  }

  home () {
    this.go('', 'CUGIRjs home')
    $('#q').val('')
    $('#summary').html('')
    this.map.clear()
    this.map.leaflet.fitBounds(this.config.homeBounds)
    $('#left-panel').html(this.config.homeHtml)
    $('.home')
      .append(this.categories())
  }

  setupMap () {
    const map = {}
    map.leaflet = L.map('map')

    // zoom to NYS
    map.leaflet.fitBounds(this.config.homeBounds)

    // add basemap using colorFilter to enhance/balance coloration
    if (Sift.cssVar('--dark')) {
      L.tileLayer.colorFilter(this.config.basemapDark, {
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
      L.tileLayer.colorFilter(this.config.basemap, {
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
    map.leaflet.on('click', e => this.clickMap(e))

    map.clear = function () {
      this.leaflet.eachLayer(function (layer) {
        if (!layer.options.isBasemap) layer.remove()
      })
      $('#attr').remove()
      $('#zoom').remove()
    }

    this.map = map
  }

  go (hash, title) {
    window.location.hash = hash
    document.title = title
  }

  search (q, querybounds) {
    // search for query q within the query bounds

    // remove superfluous quotes around single words
    q = q.replace(/"(\w+)"/g, '$1')

    this.go(Sift.escapeForHash(q), 'search for ' + q)
    $('#q').val(q)
    let results = filter(this.data, q)
    if (!querybounds) {
      querybounds = this.map.leaflet.getBounds()
    }
    results = Sift.rank(results, querybounds, this.config.limitToMap)
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
        .click(e => this.backToSearch())
        .appendTo(nav)
    }
    nav.prependTo('#summary')
    const ul =
      $('<ul id="results">')
        .data('q', q)
        .data('querybounds', querybounds)
    for (const i in results) {
      const item = results[i]
      if (!bounds) {
        bounds = L.latLngBounds(item.bbox)
      }
      bounds.extend(item.bbox)
      this.listItem(item).prependTo(ul)
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
        .click(e =>
          this.map.leaflet.fitBounds(bounds, { animate: true, duration: 1 })
        )
        .prependTo('#right-panel')
      if ($('#limitToMap').val()) {
        zoomButton.click()
      }
    }
  }

  static rank (results, bounds, limitToBounds = false) {
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
        if (limitToBounds) continue

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

  listItem (item) {
    // return list item element, and also add it to the map
    const li = $('<li>').data('item', item)
    // $('<div>').text(item._spatialscore).appendTo(li);
    $('<a class="title">')
      .text(item.title)
      .attr('href', '#id=' + item.id)
      .appendTo(li)
    $('<div class="brief">').text(item.description).appendTo(li)
    this.itemDetails(item).appendTo(li)
    $('<span>').text(item.creator + '. ').prependTo(li.find('.description'))
    const bboxlayer = L.rectangle(item.bbox, this.config.mapStyles.bbox)
      .addTo(this.map.leaflet)
    bboxlayer.options.li = li
    li.data('bbox', bboxlayer)
    li.mouseover(e => this.mouseoverResultItem(e))
    li.mouseout(e => this.mouseoutResultItem(e))
    li.click(e => this.clickResultItem(e))
    return li
  }

  mouseoverResultItem (e) {
    if ($('#results li.active').length > 0) {
      // ignore mouseover if any item is active (i.e. in detail view)
      return
    }

    // remove any highlighted result that might have been set by clicking the map
    const style = this.config.mapStyles.bbox
    $('#results li.hover').each(function (i, olditem) {
      olditem = $(olditem)
      olditem.removeClass('hover')
      const bbox = olditem.data('bbox')
      if (bbox) {
        bbox.setStyle(style)
      }
    })

    const item = $(e.currentTarget)
    item.addClass('hover')
    const bbox = item.data('bbox')
    if (bbox) {
      bbox.setStyle(this.config.mapStyles.bboxHighlight).bringToFront()
    }
  }

  mouseoutResultItem (e) {
    const item = $(e.currentTarget)
    item.removeClass('hover')
    const bbox = item.data('bbox')
    if (bbox) {
      bbox.setStyle(this.config.mapStyles.bbox)
    }
  }

  clickResultItem (e) {
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

    // deactivate any already-active item
    // and remove any download subsets
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
    this.go('id=' + item.id, item.title)

    // clear the map and hide all other results
    this.map.clear()
    $('#results li:not(.active)').hide()

    const nav = $('#nav')

    // $('<button id="backToSearch">')
    //  .text('Back to Search')
    //  .attr('href', '#'+ escapeForHash($('#results').data('q')))
    //  .appendTo(summary);

    $('.prev').remove()
    $('<button class="prev">')
      .text('« previous')
      .click(e => this.prev())
      .appendTo(nav)

    // remove any existing number
    $('.num').remove()

    // add number of current result
    const num = $('#results li').index(li) + 1
    $('<span class="num">').text(num + ' of ').prependTo('#nav')

    $('.next').remove()
    $('<button class="next">')
      .text('next »')
      .click(e => this.next())
      .appendTo(nav)

    this.map.leaflet.fitBounds(item.bbox, { animate: true, duration: 1, padding: [32, 32] })
    if (item.wms) {
      li.data('layer', this.wmsLayer(item))
    } else if (item.openindexmaps) {
      li.data('layer', this.openindexmapsLayer(item))
    } else {
      L.rectangle(item.bbox, this.config.mapStyles.unavailable)
        .addTo(this.map.leaflet)
    }
  }

  itemDetails (item) {
    const details = $('<div class="details">')
    const table = $('<table>').appendTo(details)
    const properties = this.config.firstProperties
    const hiddenProperties = this.config.hiddenProperties

    // add any other properties found in the item
    // (unless they start with _)
    const itemproperties = Object.keys(item)
    for (let i = 0; i < itemproperties.length; i++) {
      const p = itemproperties[i]
      if (properties.indexOf(p) === -1 &&
          hiddenProperties.indexOf(p) === -1 &&
          p[0] !== '_') {
        properties.push(p)
      }
    }
    for (let i = 0; i < properties.length; i++) {
      const p = properties[i]
      const v = item[p]

      // skip empty properties
      if (!v || v.length === 0) continue

      const tr = $('<tr>').appendTo(table)

      // display property name (with underscore replaced with spaces)
      $('<th>').text(p.replace('_', ' ')).appendTo(tr)

      // display value with linkify() formatting
      $('<td>').html(this.linkify(p, v)).appendTo(tr)
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

  downloadSection (item) {
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
      $('<div class="alert">')
        .text('This is an index map.  Please select features on the map to get the download links for the actual data.')
        .appendTo(div)
      $('<ul class="subsets">').appendTo(div)
      $('<div class="allclear">').appendTo(div)
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

  linkify (p, v) {
    // linkify specific fields
    if (this.config.linkify.indexOf(p) > -1) {
      // make sure v is an array
      if (!Array.isArray(v)) {
        v = [v]
      }
      const div = $('<div>')
      let count = 0
      const that = this
      for (let i = 0; i < v.length; i++) {
        const vi = v[i]
        if (count++) {
          div.append(', ')
        }
        const hash = '#' + p + '="' + vi + '"'
        $('<a>')
          .text(vi)
          .attr('href', Sift.escapeForHash(hash))
          .click(function () { that.search(hash.slice(1)) })
          .appendTo(div)
      }
      return div
    } else if (Array.isArray(v)) {
      // separate multiple values with commas
      return v.join(', ')
    }

    let max = this.config.moreLength
    if (typeof (v) === 'string' && v.length > (max * 1.2)) {
      // adjust max to chop at a space
      max = v.indexOf(' ', max - 16)
      const more = v.substr(max)
      v = v.substr(0, max) +
        '<button class="more" onclick="(function(b){$(b).next().show();$(b).remove()})(this)">more</button>' +
        '<span class="more">' + more + '<span>'
    }
    return v
  }

  // TODO get rid of this
  static cssVar (name) {
    const body = window.getComputedStyle(
      document.querySelector('body')
    )
    return body.getPropertyValue(name)
  }

  static unescapeHash (h) {
    return unescape(h).replace(/\+/g, ' ')
  }

  static escapeForHash (q) {
    const hash = escape(q.replace(/\//g, '//'))
      .replace(/%20/g, '+')
      .replace(/%23/g, '#')
      .replace(/%3A/g, ':')
      .replace(/%3D/g, '=')
    return hash
  }

  static stats (data, property) {
    // calculate frequency of property values in the data
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

  backToSearch () {
    // search with original query and boundas
    const q = $('#results').data('q')
    $('#q').val(q)
    const qbounds = $('#results').data('qbounds')
    this.search(q, qbounds)

    // scroll to where we were before
    const scroll = $('#results').data('scroll') - 160
    $('html').scrollTop(scroll)
  }

  wmsLayer (item) {
    const url = item.wms
    const options = {
      layers: item.layerid,
      format: 'image/png',
      transparent: true,
      tiled: true,
      maxZoom: 21 // default 18 is not enough
    }
    if (Sift.cssVar('--dark') &&
        url.match(/cugir/) &&
        item.geom_type.match(/point|line|polygon/i)) {
      options.styles = 'darkmode-' + item.geom_type
    }
    const layer = L.tileLayer.wms(url, options)
    layer.addTo(this.map.leaflet).bringToFront()
    return layer
  }

  openindexmapsLayer (item) {
    const that = this
    const url = item.openindexmaps
    const layer = new L.GeoJSON.AJAX(url, {
      style: that.config.mapStyles.indexmap,
      onEachFeature: function (feature, layer) {
        if (feature.properties.available === false) {
          layer.setStyle(that.config.mapStyles.unavailable)
        }
        feature.layer = layer
        layer.bindTooltip(
          feature.properties.label || feature.properties.title,
          { sticky: true, direction: 'top' }
        )
      }
    })
    layer.addTo(that.map.leaflet).bringToFront()
    return layer
  }

  prev () {
    // go to the previous item in the search results
    const prev = $('#results li.active').prev()
    if (prev) {
      prev.click()
    }
  }

  next () {
    // go to the next item in the search results
    const next = $('#results li.active').next()
    if (next) {
      next.click()
    }
  }

  clickMap (e) {
    // Does the map show an active item?
    const active = $('#results li.active')
    if (active.length > 0) {
      // Is it openindexmap, raster, or vector?
      if (active.data('item').openindexmaps) {
        this.clickIndexMap(e)
      } else if (active.data('item').geom_type === 'Raster') {
        this.clickRasterMap(e)
      } else {
        this.clickVectorMap(e)
      }
    } else if ($('#results li').length > 0) {
      // Does the map show result bboxes?
      this.clickResultsMap(e)
    }
  }

  clickResultsMap (e) {
    // forget about any previously-clicked item
    const olditem = $('#results li.hover').removeClass('hover')
    if (olditem.length > 0) {
      olditem.data('bbox').setStyle(this.config.mapStyles.bbox)
    }

    // highlight the clicked bbox and corresponding item
    const layer = this.map.leaflet.getLayerAt(e.layerPoint)

    // trigger mouseover on the item in the result list
    const li = layer.options.li.mouseover()

    // make sure the result item is visible
    $('html').scrollTop(li.offset().top - 160)

    // move to back so that other results can be clicked
    layer.bringToBack()
  }

  clickIndexMap (e) {
    const that = this
    const active = $('#results li.active')

    // get the clicked feature properties
    const features = leafletPip.pointInLayer(e.latlng, active.data('layer'))
    if (features.length === 0) {
      // no features found at the clicked point
      return false
    }
    const feature = features[0].feature
    that.showAttributes(feature.properties)

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
        style: that.config.mapStyles.indexmapSelected,
        isSelection: true
      }).addTo(that.map.leaflet)
      feature.selection = layer

      // keep track of the download button so we can remove it later
      // if the feature is clicked again
      feature.download = that.subsetDownload(feature.properties)

      // add download button
      subsets.append(feature.download)

      // remove the index map alert now that the user has started selecting features
      $('.downloads .alert').remove()
    }

    allclear.html('')
    if (subsets.children().length > 0) {
      if ($('.downloads h2').length === 0) {
        $('<h2>Selected Downloads:</h2>').insertBefore('.subsets')
      }
      $('<button id="clear-subsets">Clear selection</button>')
        .appendTo(allclear)
        .on('click', e => that.clearSelections(e))
    }
    /*
    // this works, but user may need to specify location for each file
    // and it may not work in some browsers
    if (subsets.children().length > 1) {
      $('<button id="download-all">Download all selected subsets</button>')
        .appendTo(allclear)
        .on('click', e => that.downloadAll(e))
    }
    */
  }

  subsetDownload (p) {
    let name = p.label
    if (!name) name = p.title
    const a = $('<a>')
      .addClass('download')
      .attr('target', '_blank')
      .attr('href', p.downloadUrl)
      .text(name)
    return $('<li>').append(a)
  }

  /*
  downloadAll (e) {
    $('.subsets .download').each(function (i, link) {
      const url = $(link).attr('href')
      // wait 500ms between downloads in an attempt to keep the browser happy
      setTimeout(function () { window.location = url }, 500 * i)
    })
  }
  */

  clearSelections (e) {
    // remove everything from downloads section
    $('.allclear, .subsets').html('')
    $('.downloads h2').remove()
    // remove selections from map
    this.map.leaflet.eachLayer(function (layer) {
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

  clickVectorMap (e) {
    const that = this
    const active = $('#results li.active')
    const item = active.data('item')

    // calc generous bbox for the clicked point (+/- 3 pixels)
    // otherwise it is difficult to click a point feature
    const bounds = this.map.leaflet.getBounds()
    const pixelsize = (bounds._northEast.lat - bounds._southWest.lat) / this.map.leaflet.getSize().y
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
        that.map.leaflet.eachLayer(function (layer) {
          if (layer.options.isSelection) {
            layer.remove()
          }
        })

        // highlight feature and show attributes
        const style = that.config.mapStyles.featureHighlight
        L.geoJSON(match, {
          // display any points as little circles
          pointToLayer: function (point, latlng) {
            return L.circleMarker(latlng, { color: cssVar('--map-feature-highlight-color') })
          },
          style: style,
          isSelection: true
        }).addTo(that.map.leaflet)
        that.showAttributes(properties)
      },
      error: function (xhr, status, error) {
        console.log(xhr)
        console.log(status)
        console.log(error)
      }
    })
  }

  clickRasterMap (e) {
    const that = this
    const item = $('#results li.active').data('item')
    const bounds = this.map.leaflet.getBounds()
    const x1 = bounds._southWest.lng
    const x2 = bounds._northEast.lng
    const y1 = bounds._southWest.lat
    const y2 = bounds._northEast.lat
    const size = this.map.leaflet.getSize()
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
    $.ajax({
      url: url,
      dataType: 'json',
      success: function (data, status, xhr) {
        // remove any existing highlighted point
        that.map.leaflet.eachLayer(function (layer) {
          if (layer.options.isSelection) {
            layer.remove()
          }
        })
        // show feature and attributes
        const layer = L.circleMarker(e.latlng, {
          style: that.config.mapStyles.featureHighlight,
          isSelection: true,
          color: cssVar('--map-feature-highlight-color')
        }).addTo(that.map.leaflet)
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

  showAttributes (properties) {
    $('#attr').remove()
    const info = $('<div id="attr">').appendTo('body')
    const table = $('<table>')
      .html('<tr class="head"><th colspan="2">Attributes<button class="close">X</button></th></tr>')
      .appendTo(info)
    $('.close').click(e => this.clearSelections(e))
    // show all properties
    // TODO custom view for new openindexmaps w/thumbnail, etc
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

  listenForKeys (e) {
    if (e.key === 'Escape') {
      this.clearSelections()
    } else if (e.key === 'PageDown') {
      this.next()
    } else if (e.key === 'PageUp') {
      this.prev()
    } else if (e.key === 'Enter') {
      $('#results li.hover').click()
    }
  }

  categories () {
    // return a <ul> listing all categories (and number of datasets in each)
    const div = $('<ul id="categories">')
    const catstat = Sift.stats(this.data, 'category')
    const cats = Object.keys(catstat).sort()
    const that = this
    for (let i = 0; i < cats.length; i++) {
      const li = $('<li>').appendTo(div)
      const hash = '#category="' + cats[i] + '"'
      $('<a>')
        .text(cats[i])
        .attr('href', hash)
        .click(function () { that.search(hash.slice(1)) })
        .appendTo(li)
      $('<span class="count">').html('&nbsp;(' + catstat[cats[i]] + ') ')
        .appendTo(li)
    }
    return div
  }
}
