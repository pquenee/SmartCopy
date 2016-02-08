// Parse FamilySearch Genealogies
function parseFamilySearchJSON(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = null;
    try {
        var parsed = JSON.parse(htmlstring);
    } catch(err) {
        console.log(err);
    }

    if (!exists(parsed)) {
        return "";
    }

    var focusperson = parsed["data"]["name"];
    var focusdaterange = parsed["data"]["lifeSpan"] || "";

    document.getElementById("readstatus").innerText = focusperson;

    var genderval = String(parsed["data"]["gender"] || "unknown").toLowerCase();
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";

    var alive = parsed["data"]["isLiving"] || null;
    if (alive !== null) {
        profiledata["alive"] = alive;
    }

    if (parsed["data"]["birthConclusion"]) {
        var eventinfo = parsed["data"]["birthConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            profiledata["birth"] = data;
        }
    }
    if (parsed["data"]["christeningConclusion"]) {
        var eventinfo = parsed["data"]["christeningConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            profiledata["baptism"] = data;
        }
    }
    if (parsed["data"]["deathConclusion"]) {
        var eventinfo = parsed["data"]["deathConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            if (exists(getDate(data))) {
                deathdtflag = true;
            }
            profiledata["death"] = data;
        }
    }
    if (parsed["data"]["burialConclusion"]) {
        var eventinfo = parsed["data"]["burialConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            if (exists(getDate(data))) {
                burialdtflag = true;
            }
            if (exists(getLocation(data))) {
                buriallcflag = true;
            }
            profiledata["burial"] = data;
        }
    }
    if (parsed["data"]["otherConclusions"]) {
        var eventinfo = parsed["data"]["otherConclusions"];
        var nicknames = "";
        //* '''Residence''': Clark County, KY - 1800
        for (var i = 0; i < eventinfo.length; i++) {
            var evt = eventinfo[i];
            var type = evt["type"].toLowerCase();
            if (type === "residence" || type === "military_service" || type === "naturalization") {
                var abt = "* '''" + NameParse.fix_case(type) + "''': ";
                var residence = evt["details"];
                if (residence["place"] && residence["place"]["originalText"]) {
                    abt = abt + residence["place"]["originalText"];
                    if (residence["date"] && residence["date"]["originalText"]) {
                        abt = abt + " - " + residence["date"]["originalText"];
                    }
                    aboutdata += abt + "\n";
                }
            } else if (type === "alternate_name") {
                var evt = eventinfo[i];
                if (evt["details"] && evt["details"]["fullText"]) {
                    var altname = evt["details"]["fullText"].replace(/,/g,"").replace(/&quot;/g,'"').trim();
                    if (!nicknames.contains(altname)) {
                        if (nicknames !== "") {
                        nicknames += ",";
                        }
                        nicknames += altname;
                    }
                }
            }
        }
        if (nicknames !== "") {
            profiledata["nicknames"] = nicknames;
        }
    }

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    if (familymembers) {
        profiledata["url"] = "https://familysearch.org/tree/#view=ancestor&person=" + focusURLid;
    } else {
        profiledata["url"] = "https://familysearch.org/tree/#view=ancestor&person=" + relation.itemId;
    }

    // ---------------------- Family Data --------------------
    if (familymembers) {
        familystatus.push(famid);
        var url = "https://familysearch.org/tree-data/family-members/person/" + focusURLid + "?includePhotos=true&locale=en";
        chrome.extension.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url,
            variable: profiledata
        }, function (response) {
            var arg = response.variable;
            var source = JSON.parse(response.source);
            if (source["data"]["parents"]) {
                var jsonrel = source["data"]["parents"];
                var parentset;
                for (var x = 0; x < jsonrel.length; x++) {
                    if (jsonrel[x]["children"]) {
                        var childset = jsonrel[x]["children"];
                        for (var i = 0; i < childset.length; i++) {
                            if (childset[i]["id"] === focusURLid) {
                                parentset = jsonrel[x]["coupleId"];
                                var image = childset[i]["portraitUrl"] || "";
                                if (image !== "" && image.startsWith("http")) {
                                    profiledata["image"] = image;
                                    profiledata["thumb"] = image;
                                }
                                var parents = parentset.split("_");
                                var data = parseFSJSONUnion(jsonrel[x]["event"]);
                                for (var y=0; y < parents.length; y++) {
                                    var parentid = parents[y];
                                    var image = "";
                                    if (jsonrel[x]["husband"] && jsonrel[x]["husband"]["id"] === parentid) {
                                        image = jsonrel[x]["husband"]["portraitUrl"] || "";
                                    } else if (jsonrel[x]["wife"] && jsonrel[x]["wife"]["id"] === parentid) {
                                        image = jsonrel[x]["wife"]["portraitUrl"] || "";
                                    }
                                    if (y === 0) {
                                        processFamilySearchJSON(parentid, "parents", famid, image, data);
                                    } else {
                                        processFamilySearchJSON(parentid, "parents", famid, image);
                                    }
                                    famid++;
                                }
                                break;
                            }
                        }
                    }
                }
                for (var x = 0; x < jsonrel.length; x++) {
                    if (jsonrel[x]["children"]) {
                        var childset = jsonrel[x]["children"];
                        var coupleid = jsonrel[x]["coupleId"];
                        for (var i = 0; i < childset.length; i++) {
                            if (childset[i]["id"] !== focusURLid) {
                                var relation = "sibling";
                                if (parentset !== coupleid) {
                                    relation = "halfsibling"
                                }
                                var image = childset[i]["portraitUrl"] || "";
                                processFamilySearchJSON(childset[i]["id"], relation, famid, image);
                                famid++;
                            }
                        }
                    }
                }
                var jsonrel = source["data"]["spouses"];
                for (var x = 0; x < jsonrel.length; x++) {
                    var spouse = "";
                    var image = "";
                    if (jsonrel[x]["husband"] && jsonrel[x]["husband"]["id"] !== focusURLid) {
                        spouse = jsonrel[x]["husband"]["id"];
                        image = jsonrel[x]["husband"]["portraitUrl"] || "";
                    } else if (jsonrel[x]["wife"] && jsonrel[x]["wife"]["id"] !== focusURLid) {
                        spouse = jsonrel[x]["wife"]["id"];
                        image = jsonrel[x]["wife"]["portraitUrl"] || "";
                    }
                    if (spouse !== "") {
                        var data = parseFSJSONUnion(jsonrel[x]["event"]);
                        var valid = processFamilySearchJSON(spouse, "spouse", famid, image, data);
                        if (valid) {
                            myhspouse.push(famid);
                            famid++;
                        }
                    }
                    if (jsonrel[x]["children"]) {
                        var childset = jsonrel[x]["children"];
                        for (var i = 0; i < childset.length; i++) {
                            var itemid = childset[i]["id"];
                            var image = childset[i]["portraitUrl"] || "";
                            var valid = processFamilySearchJSON(itemid, "child", famid, image);
                            if (valid) {
                                childlist[famid] = $.inArray(spouse, unionurls);
                                profiledata["parent_id"] = $.inArray(spouse, unionurls);
                                famid++;
                            }
                        }
                    }
                }
            }
            familystatus.pop();
        });
    }

    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

    if (!burialdtflag && buriallcflag && deathdtflag && $('#burialonoffswitch').prop('checked')) {
        profiledata = checkBurial(profiledata);
    }

    if (aboutdata.trim() !== "") {
        profiledata["about"] = cleanHTML(aboutdata);
        // "\n--------------------\n"  Merge separator
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }
    return profiledata;

}

function parseFSJSONUnion(eventinfo) {
    var data = [];

    if (eventinfo && eventinfo["type"] && eventinfo["type"].toLowerCase() === "marriage") {
        var dateval = "";
        if (eventinfo["standardDate"]) {
            dateval = eventinfo["standardDate"];
        } else if (eventinfo["originalDate"]) {
            dateval = eventinfo["originalDate"];
        }
        if (dateval !== "") {
            data.push({date: cleanDate(dateval)});
        }
        var eventlocation = "";
        if (eventinfo["standardPlace"]) {
            eventlocation = eventinfo["standardPlace"].trim();
        } else if (eventinfo["originalPlace"]) {
            eventlocation = eventinfo["originalPlace"].trim();
        }
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return data;
}

function parseFSJSONDate(eventinfo) {
    var data = [];
    var details = [];
    if (eventinfo["details"]) {
        details = eventinfo["details"];
    } else {
        details = eventinfo;
    }

    if (details["date"]) {
        var dateval = "";
        if (details["date"]["normalizedText"]) {
            dateval = details["date"]["normalizedText"];
        } else if (details["date"]["localizedText"]) {
            dateval = details["date"]["localizedText"];
        } else if (details["date"]["originalText"]) {
            dateval = details["date"]["originalText"];
        } else if (details["date"]["original"]) {
            dateval = details["date"]["original"];
        }
        if (details["date"]["modifier"] && !dateval.toLowerCase().startsWith(details["date"]["modifier"].toLowerCase())) {
            dateval =  details["date"]["modifier"] + " " + dateval;
        }
        if (checkNested(details["date"],"fields",0,"values",0,"labelId")) {
            if (details["date"]["fields"][0]["values"][0]["labelId"].contains("EST")) {
               dateval =  "Circa " + dateval;
            }
        }
        if (dateval !== "") {
            data.push({date: cleanDate(dateval)});
        }
    }
    if (details["place"]) {
        var eventlocation = "";
        if (details["place"]["normalizedText"]) {
            eventlocation = details["place"]["normalizedText"].trim();
        } else if (details["place"]["localizedText"]) {
            eventlocation = details["place"]["localizedText"].trim();
        } else if (details["place"]["originalText"]) {
            eventlocation = details["place"]["originalText"].trim();
        } else if (details["place"]["original"]) {
            eventlocation = details["place"]["original"].trim();
        }
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return data;
}



function getFamilySearchJSON(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseFamilySearchJSON(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
        if (person === "") {
            familystatus.pop();
            return;
        }
        if (arg.halfsibling) {
            person["halfsibling"] = true;
        }
        if (arg.image) {
            person["image"] = arg.image;
            person["thumb"] = arg.image;
        }
        //person = updateInfoData(person, arg);
        person["profile_id"] = arg.profile_id;
        databyid[arg.profile_id] = person;
        alldata["family"][arg.title].push(person);
        familystatus.pop();
    });
}

function processFamilySearchJSON(itemid, title, famid, image, data) {
    if (itemid === focusURLid) {
        return false;
    }
    var url = "https://familysearch.org/tree-data/person/" + itemid + "/all?locale=en";
    if (!exists(alldata["family"][title])) {
        alldata["family"][title] = [];
    }
    if (isParent(title)) {
        parentlist.push(itemid);
    }

    var subdata = {title: title, url: url, itemId: itemid, profile_id: famid};
    if (!$.isEmptyObject(data)) {
        subdata["marriage"] = data;
    }
    if (title === "halfsibling") {
        subdata["halfsibling"] = true;
    }
    if (image !== "") {
        subdata["image"] = image;
    }
    unionurls[famid] = itemid;
    getFamilySearchJSON(famid, url, subdata);
    return true;
}