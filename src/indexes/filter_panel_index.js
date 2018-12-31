import "../../css/jquery-ui-bootstrap/jquery-ui-1.10.3.custom.css";
import "../../css/fa-5.5.0/all.css";
import "../../css/ciview.css";
import "../../css/dc.min.css";
import "../../css/gridstack.css";
import "../vendor/jquery-ui.min.js";
import "../vendor/jquery-ui-fixes.js";
import {d3} from "../vendor/d3.js";
import {dc} from "../vendor/dc.js";
import {FilterPanel} from "../graphs.js";
window.FilterPanel = FilterPanel;
window.$=$;
window.dc=dc;
window.d3=d3