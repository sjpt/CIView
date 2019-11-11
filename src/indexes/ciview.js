import "../../css/jquery-ui-bootstrap/jquery-ui-1.10.3.custom.css";
import "../../css/slickgrid/slick.grid.css";
import "../../css/slickgrid/slick.default.theme.css";
import "../../css/fa-5.5.0/all.css";
import "../../css/dc.min.css";
import "../../css/gridstack.css";
import "../../css/ciview.css";


import "../vendor/jquery-ui.min.js";
import "../vendor/jquery-ui-fixes.js";

import {FilterPanel} from "../graphs.js";
import {MLVImageTable} from "../image_table.js";
import {FilterPanelDataView} from "../mlv_table.js";
window.FilterPanel = FilterPanel;
window.$ =$;
window.MLVImageTable = MLVImageTable;
window.FilterPanelDataView = FilterPanelDataView;
