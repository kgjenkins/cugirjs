<!DOCTYPE html>
<html>
<head>
<meta charset='UTF-8'>
<meta http-equiv="pragma" content="no-cache" />
<title>cugirjs</title>
<link rel='icon' type='image/png' href='image/favicon.ico'>
<link rel="stylesheet" href="lib/leaflet/leaflet.css" />
<link rel='stylesheet' type='text/css' href='cugir.css?t=<?php echo time() ?>'>
<script src='lib/jquery-3.3.1.min.js'></script>
<script src='lib/leaflet/leaflet.js'></script>
<script src="lib/leaflet/leaflet-tilelayer-colorfilter.min.js"></script>
<script src='lib/leaflet/leaflet-pip.js'></script>
<script src='lib/json-filter.js'></script>
<script src='cugirjson.js'></script>
<script src='cugir.js?t=<?php echo time() ?>'></script>
</head>
<body>
  <div id="head">
    <form id="search">
      <img id="logo" src="image/cugir-logo.png" />
      <input id="q" type="text" autofocus />
      <button id="searchButton" type="submit">search</button>
    </form>
    <div id="menu">
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
      <a href="https://cul-it.github.io/cugir-help/">Help</a>
    </div>
  </div>
  <div id="map"></div>
  <div id="body"></div>
</body>
</html>
