
$(document).ready(function(){
  showHome();
  $(document).on('click', '#searchButton', clickSearchButton)
});

function showHome() {
  var catstat = stats('cugir_category_sm');
  var categories = Object.keys(catstat);
  categories = categories.sort(function(a,b){
    if (a<b) return -1
    else if (a>b) return 1;
    else return 0;
  });
  $('#body').html('<h1>Welcome to CUGIR!</h1><p>Explore and discover New York State data and metadata related to:</p><div id="categories"></div>');
  for (var i=0; i<categories.length; i++) {
    $('<a>')
      .text(categories[i])
      .click(clickCategory)
      .appendTo('#categories');
  }
}

function clickCategory(e){
  var category = $(e.target).text();
  search('cugir_category_sm="'+category+'"');
}

function clickSearchButton(e){
  var q = $('#q').val();
  search(q);
}

function search(q){
  console.log(q);
  $('#q').val(q);
  var results = filter(cugirjson, q);
  $('#body').html('');
  $('<div id="searchSummary">').text(Object.keys(results).length + ' matches for ').append(
    $('<span>').addClass('q').text(q)
  ).appendTo('#body');
  var ul = $('<ul>');
  for (var i in results) {
    var item = results[i];
    $('<li>').text(item.dc_title_s).appendTo(ul);
  }
  ul.appendTo('#body');
}

function showResultSummary(results){
}

function stats(property){
  var seen = {}
  for (var i=0; i<cugirjson.length; i++) {
    var item = cugirjson[i];
    var value = item[property];
    for (var j=0; j<value.length; j++) {
      var valuej = value[j];
      if (typeof seen[valuej] !== 'undefined') {
        seen[valuej] += 1;
      }
      else {
        seen[valuej] = 1;
      }
    }
  }
  return seen;
}
