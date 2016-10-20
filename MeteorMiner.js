// ==UserScript==
// @name         Meteor Miner
// @namespace    MeteorMiner
// @version      0.1
// @description  Extract data form Meteor
// @author       Tim Medin (Counter Hack)
// @match        http://*/*
// @match        https://*/*
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @resource     https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

/**
 * Checks if Meteor is loaded in the current page
 * @return {Boolean}
 */
function meteorIsLoaded() {
    return typeof(unsafeWindow.Meteor) === 'object' ? true : false;
}

/**
 * Get a sorted array of loaded Templates
 * @return [String] Names of loaded templates
 */
function getLoadedTemplateNames() {
    tmpls = [];
    $.each($('div'), function(index, elem) {
        if (Blaze.getView(elem)) {
            tmpls.push(Blaze.getView(elem).name);
            if (Blaze.getView(elem).parentView) {
                tmpls.push(Blaze.getView(elem).parentView.name);
            }
        }
    });

    tmplsFiltered = [];
    $.each($.unique(tmpls), function(index, t) {
        if (/^Template\./.test(t)) {
            tmplsFiltered.push(t.replace(/^Template\./,''));
        }
    });
    return tmplsFiltered.sort();
}

/**
 * Get a sorted array of Templates loaded by Meteor
 * @return [String] Names of templates
 */
function getTemplateNames() {
    loadedTmpls = getLoadedTemplateNames();

    // ignore the build in stuff
    ignoredTemplates = ['body', '__body__', '__dynamic', '__dynamicWithDataContext', '__DynamicTemplateError__', '__IronDefaultLayout__', '__IronRouterNotFound__', '__IronRouterNoRoutes__', 'ensureSignedIn', 'atError', 'atForm', 'atInput', 'atTextInput', 'atCheckboxInput', 'atSelectInput', 'atRadioInput', 'atHiddenInput', 'atMessage', 'atNavButton', 'atOauth', 'atPwdForm', 'atPwdFormBtn', 'atPwdLink', 'atReCaptcha', 'atResult', 'atSep', 'atSigninLink', 'atSignupLink', 'atSocial', 'atTermsLink', 'atResendVerificationEmailLink', 'atTitle', 'fullPageAtForm', 'reactiveTable', 'reactiveTableFilter'];
    var tmpls = [];
    for (var tmplName in Template) {
        // Filter for templates and ignore those in the above list
        if ($.inArray(tmplName, ignoredTemplates) === -1 && Template[tmplName] instanceof Template) {
            // remove `Template.` from  the template name
            tmpls.push(tmplName.replace(/^Template\./,''));
        }
    }
    return tmpls.sort();
}

/**
 * Get all the collections loaded by Meteor
 * @return [Object] Array of associative arrays of collection Info
 *         name         Collection Name
 *         instance     The collection object
 *         count        Record count
 *         fieldCounts  Associative array
 *             key      Fields
 *             value    Number of records with the above fields
 */
function getCollections() {
    //return Meteor.connection._mongo_livedata_collections;
    var cols = [];
    // Global collections
    for (var objectName in unsafeWindow) {
        if (unsafeWindow[objectName] instanceof Meteor.Collection) {
            cols.push({name: objectName, instance: unsafeWindow[objectName], count: unsafeWindow[objectName].find().count()});
        }
    }
    // Meteor collections
    for (var objectName in unsafeWindow.Meteor) {
        if (unsafeWindow.Meteor[objectName] instanceof Meteor.Collection) {
            cols.push({name: 'Meteor.' + objectName, instance: unsafeWindow.Meteor[objectName], count: unsafeWindow.Meteor[objectName].find().count()});
        }
    }

    // check for non-uniform fields in collection
    for (var c of cols) {
        counts = {};
        if (c.instance.find().count() > 0) {
            fields = [];
            for (var r of c.instance.find().fetch()) {
                fieldNames = deepPropertyNames(r).toString();
                counts[fieldNames] = (counts[fieldNames] + 1) || 1;
            }
        }
        c.fieldCounts = counts;
    }

    // sort the collections by name
    cols = cols.sort(function(a,b){
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    });
    return cols;
}

/**
 * Update the panel
 * @return null
 */
function updateInfo() {
    // Templates
    templateList = $('#meteor-miner #mm-templates-list');
    loadedTmpls = getLoadedTemplateNames();
    $.each(getTemplateNames(), function(index,tmplName) {
        tmplDiv = templateList.find('[name="' + tmplName + '"]');
        if (tmplDiv.length === 0) {
            // not loaded, create a stub
            r = templateList.append('<div name="' + tmplName + '">' + tmplName + '</div>');
            tmplDiv = templateList.find('[name="' + tmplName + '"]');
        }
        // is loaded?
        if ($.inArray(tmplName, loadedTmpls) !== -1) {
            tmplDiv.removeClass('mm-not-loaded').addClass('mm-loaded');
        } else {
            tmplDiv.removeClass('mm-loaded').addClass('mm-not-loaded');
        }
        tmplDiv.data('template', Template[tmplName]);
    });

    // Collections
    collectionList = $('#meteor-miner #mm-collections-list');
    $.each(getCollections(), function(index,col) {
        uniqueFieldCount = Object.keys(col.fieldCounts).length;
        if (uniqueFieldCount >= 2) {
            uniqueFieldCountText = uniqueFieldCount + ' Unique Field Sets';
        } else {
            uniqueFieldCountText = '';
        }
        colDiv = collectionList.find('[name="' + col.name + '"]');
        loaded = col.count > 0;
        if (colDiv.length === 0) {
            // not loaded, create a stub
            collectionList.append('\
                 <div name="' + col.name + '" class="collection">' + col.name + ' \
                    <div class="size"></div> \
                    <div class="field-counts"></div> \
                 </div>');
            colDiv = collectionList.find('[name="' + col.name + '"]');
        }
        // has data?
        if (col.count > 0) {
            colDiv.removeClass('mm-not-loaded').addClass('mm-loaded');
            colDiv.find('.size').text(col.count + ' Records');
            colDiv.find('.field-counts').text(uniqueFieldCountText);
        } else {
            colDiv.removeClass('mm-loaded').addClass('mm-not-loaded');
            colDiv.find('.size').text('0 Records');
            colDiv.find('.field-counts').text(uniqueFieldCountText);
        }
        // bind the collection info to the div
        colDiv = $('#mm-collections-list div[name="' + col.name + '"]');
        colDiv.data('collectionInfo', col);
    });

    // Subscriptions
    subsList = $('#meteor-miner #mm-subscriptions-list');
    subs = unsafeWindow.Meteor.connection._subscriptions;
    for (var sKey in subs) {
        sub = subs[sKey];
        subDiv = subsList.find('[name="' + sub.name + '"]');
        if (subDiv.length === 0) {
            // not loaded, create a stub
            subsList.append('<div name="' + sub.name + '">' + sub.name + '<div class="params"></div></div>');
            subDiv = subsList.find('[name="' + sub.name + '"]');
        }
        if (sub.ready) {
            subDiv.addClass('mm-ready').removeClass('mm-not-ready');
        } else {
            subDiv.removeClass('mm-ready').addClass('mm-not-ready');
        }
        if (sub.params.length) {
            paramArray = [];
            for (var i=0; i<sub.params.length; i++) {
                if (typeof(sub.params[i]) === 'undefined') {
                    paramArray.push('undefined');
                } else {
                    paramArray.push(sub.params[i].toString());
                }
            }
            subDiv.find('.params').text('Param Values: ' + paramArray.toString());
        } else {
            subDiv.find('.params').text('');
        }
    }
}

// ********************************************************************************
// ********************************************************************************
// ***                                                                          ***
// ***                              HELPERS                                     ***
// ***                                                                          ***
// ********************************************************************************
// ********************************************************************************


/**
 * Get the property names from an object
 * @param {Object}  The object to analyze
 * @param {Number}  The depth to search, default is 2
 * @return [String] Array of field names
 */
function deepPropertyNames(o, depth) {
    depth = depth || 2;
    var propNames = [];
    Object.getOwnPropertyNames( o ).forEach(function( name ) {
        // don't get details if..
        //   too deep
        //   Array
        //   Date
        if (typeof(o[name]) === 'object' && o[name] !== null && !(o[name] instanceof Date) && !(o[name] instanceof Array) && depth > 1) {
            result = deepPropertyNames(o[name], depth - 1);
            result.forEach(function( name2 ) {
                propNames.push(name + '.' + name2);
            });
        } else {
            propNames.push(name);
        }
    });
    return propNames.sort();
}

/**
 * Plurize the text if there is not 1 item
 * @param num {Number}  Number of items used to determine if plural
 * @param text {String} Text to make plural
 * @return {String}     Resultant plural (or not) text
 */
function plural(num, text) {
    if (num === 1) return text;
    return text + 's';
}

function testing() {
    return;
    for (var r of Meteor.users.find().fetch()) {
        fieldNames = deepPropertyNames(r).toString();
        console.log(fieldNames);
        //counts[fieldNames] = (counts[fieldNames] + 1) || 1;
    }
}

// ********************************************************************************
// ********************************************************************************
// ***                                                                          ***
// ***                              EVENTS                                      ***
// ***                                                                          ***
// ********************************************************************************
// ********************************************************************************

/**
 * Get click on collections, show field info
 */
$('body').on('click', '#meteor-miner #mm-collections-list div', function(event) {
    // do something
    event.preventDefault();
    event.stopPropagation();
    if ($(event.target).hasClass('collection')) {
        target = $(event.target);
    } else {
        target = $(event.target).parent();
    }

    cInfo = target.data('collectionInfo');
    // get the fields
    //fieldsOutput = [];
    //cDetailsHtml = '<table><thead><tr><th>Cnt </th><th>Fields</th></tr></thead><tbody>';
    cDetailsHtml = '';
    for (var fields of Object.keys(cInfo.fieldCounts)) {
        //console.log(cInfo.fieldCounts[fields] + ' - ' + fields);
        //console.log(fields);
        //console.log();
        //fieldsOutput.push(cInfo.fieldCounts[fields] + ' - ' + fields.replace(/,/g, ', '));
        //cDetailsHtml += '<tr><td style="text-align: center;">' + cInfo.fieldCounts[fields] + '</td><td>' + fields.replace(/,/g, ', ') + '</td></tr>';
        cDetailsHtml += '<div class="header">' + cInfo.fieldCounts[fields] + plural(cInfo.fieldCounts[fields], ' record') + ':</div><div class="detail">' + fields.replace(/,/g, ', ') + '</div>';
    }
    //cDetailsHtml += '</tbody></table>';

    // set the details info
    $('#meteor-miner .mm-secondary-panel .mm-secondary-header').text('Field Details for ' + cInfo.name);
    $('#meteor-miner .mm-secondary-panel .mm-secondary-details').html(cDetailsHtml);

    $('#meteor-miner .mm-main-panel').hide();
    $('#meteor-miner .mm-secondary-panel').show();

});

/**
 * Get click on template, show functions
 */
$('body').on('click', '#meteor-miner #mm-templates-list div', function(event) {
    tmpl = $(event.target).data('template');

    detailsHtml = '';
    // helpers
    detailsHtml += '<div class="header">Helpers</div>';
    if ('__helpers' in tmpl) {
        for (var h in tmpl.__helpers) {
            if ($.inArray(h, ['has', 'get', 'set']) === -1) {
                detailsHtml += '<div class="detail">' + h.replace(/^ +/,'') + '</div>';
            }
        }
    } else {
        detailsHtml += '<div class="detail">None</div>';
    }

    // event map
    detailsHtml += '<div class="header">Event Map</div>';
    if ('__eventMaps' in tmpl) {
        for (var i=0; i<tmpl.__eventMaps.length; i++) {
            for (var e in tmpl.__eventMaps[i]) {
                if ($.inArray(e, ['has', 'get', 'set']) === -1) {
                    detailsHtml += '<div class="detail">' + e.replace(/^ +/,'') + '</div>';
                }
            }
        }
    } else {
        detailsHtml += '<div class="detail">None</div>';
    }

    $('#meteor-miner .mm-secondary-panel .mm-secondary-header').text('Template ' + tmpl.viewName.replace(/^Template\./,''));
    $('#meteor-miner .mm-secondary-panel .mm-secondary-details').html(detailsHtml);

    $('#meteor-miner .mm-main-panel').hide();
    $('#meteor-miner .mm-secondary-panel').show();

});

/**
 * Move from the secondary panel to the main panel
 */
$('body').on('click', '#meteor-miner * .mm-secondary-nav', function(event) {
    // do something
    event.preventDefault();
    event.stopPropagation();
    $('#meteor-miner .mm-main-panel').show();
    $('#meteor-miner .mm-secondary-panel').hide();
});


// ********************************************************************************
// ********************************************************************************
// ***                                                                          ***
// ***                              Main Event                                  ***
// ***                                                                          ***
// ********************************************************************************
// ********************************************************************************


$(document).ready(function() {
    'use strict';

    // Only run the code if Meteor is loaded
    if (!meteorIsLoaded()) {
        return;
    }

    // create menu, scope to only apply to this plugin
    GM_addStyle('#meteor-miner { padding: 5px; color: white; top: 0; right: 0; background-color: rgba(0, 0, 0, 0.7); width: 20%; position: fixed !important; z-index: 9999; overflow: scroll; resize: both; max-width: 90%; max-height: 90%;};');
    GM_addStyle('#meteor-miner .mm-header { padding: 0 0 3px 0; margin: 0; font-size: larger; font-weight: bold; };');
    GM_addStyle('#meteor-miner * .mm-loaded {color: green;};');
    GM_addStyle('#meteor-miner * .mm-not-loaded {color: grey;};');
    GM_addStyle('#meteor-miner * .mm-ready {color: green;};');
    GM_addStyle('#meteor-miner * .mm-not-ready {color: red;};');
    GM_addStyle('#meteor-miner * .mm-hide-not-loaded div.mm-not-loaded { display: none; };');
    GM_addStyle('#meteor-miner * .mm-list div { font-size: smaller; padding-left: 10px; };');
    GM_addStyle('#meteor-miner * .mm-list div.size { display: inline; font-size: smaller; padding-left: 10px; color: grey; };');
    GM_addStyle('#meteor-miner * .mm-list div.params { display: inline; font-size: smaller; padding-left: 10px; color: grey; };');
    GM_addStyle('#meteor-miner * .mm-list div.field-counts { display: inline; font-size: smaller; padding-left: 10px; color: grey; };');
    GM_addStyle('#meteor-miner * .mm-secondary-nav { color: #888; display: inline-block; };');
    GM_addStyle('#meteor-miner * .mm-secondary-header { display: inline-block; };');
    GM_addStyle('#meteor-miner * .mm-secondary-details table { border-collapse: collapse; width: 100%; font-size: smaller; };');
    GM_addStyle('#meteor-miner * .mm-secondary-details .header { font-weight: bold; display: block; }');
    GM_addStyle('#meteor-miner * .mm-secondary-details .detail { font-size: smaller ; display: block; padding-left: 5px; }');

    // the window to show the Meteor info
    jQuery('<div/>', {
        id: 'meteor-miner',
        html: ' \
            <div class="mm-main-panel"> \
                <div class="mm-main-header mm-header">Meteor Miner</div> \
                <div class="mm-main-details"> \
                    <div class="mm-hide-not-loaded-toggle" onclick="$(\'[id^=mm-][id$=-list]\').toggleClass(\'mm-hide-not-loaded\')">Toggle Loaded Only</div> \
                    <div class="mm-collections-header">Collections</div><div id="mm-collections-list" class="mm-list mm-hide-not-loaded"></div> \
                    <div class="mm-subscriptions-header">Subscriptions</div><div id="mm-subscriptions-list" class="mm-list mm-hide-not-loaded"></div> \
                    <div class="mm-templates-header" onclick="$(\'#mm-templates-list\').toggle();">Templates</div> \
                    <div id="mm-templates-list" class="mm-list mm-hide-not-loaded"></div> \
                </div> \
            </div> \
            <div class="mm-secondary-panel" style="display: none;"> \
                <div class="mm-secondary-nav mm-header">&lt;</div> \
                <div class="mm-secondary-header mm-header"></div> \
                <div class="mm-secondary-details"></div> \
            </div>',
        draggable: true
    }).appendTo('body');
    var mm = $('#meteor-miner');
    mm.resizable({ handles: 'all' });

    updateInfo();
    //setTimeout(updateInfo, 1000);
    setInterval(updateInfo, 1000);
    //setTimeout(testing, 1000);

});
