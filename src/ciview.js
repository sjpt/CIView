import {FilterPanel}  from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {MLVImageTable,MLVImageTableControls} from "./image_table.js";
import {FilterPanelDataView} from "./mlv_table.js";

class CIView{

	

	constructor(config){
		let self=this;

		this.filters={};

		
		let div = $("#"+config.table_div);
		this.control_div=$("<div>").css({width:"100%",height:"26px"}).attr("id","civ-control").appendTo(div);
		let table_div= $("<div>").css({top:"25px",height:"calc(100% - 26px)"}).attr("id","civ-table").appendTo(div);
		let grid_div = $("<div>")
		this.filter_panel = new FilterPanel(config.filter_div,config.data);
		this.data_view =  new FilterPanelDataView(null,this.filter_panel);
		this.data_view.addFilter({name:"Peak Width",datatype:"double",field:"field4"});
		this.image_table =  new MLVImageTable(table_div,this.data_view,config.image_base_url);
		this.data = config.data;

		new MLVImageTableControls(this.image_table,this.control_div);

		
		for (let item of config.graph_groups){
			for (let graph of item.graphs){
				this.filter_panel.addChart(graph.type,graph.params,graph.name);	
			}		
			
		}
		this.filter_panel.refresh();
		this.data_view.setItems(config.data);

		this.image_table.addListener("data_changed",function(field,data){
			self.filter_panel.dataChanged(field,true);
		});
		this.data_view.onRowsChanged.subscribe(function (e, args) {
         	self.image_table.show(1);
        });

	}

	addFilterSet(name,config,div){
			this.filter_panel.addFilterSet(name,null,div);
			for (let graph of config){
				this.filter_panel.addChart(name,graph.type,graph.params,graph.name)
			}

	}

	addGraph(panel_name,type,params,name){
		this.filter_panel.addChart(panel_name,type,params,name)
	}


	removeFilterSet(name,empty_only){
		this.filter_panel.removeFilterSet(name,empty_only);
	}



	addFilter(param,filter,name){
		let dim = this.filter_panel.ndx.dimension(function(d){
			return d[param];
		});
		dim.filter(function(d){
			return filter(d);
		});
		this.filters[name]=dim;
		dc.redrawAll();
		this.filter_panel._chartFiltered(dim.top(1000000));

	}

	removeFilter(name){
		let dim = this.filters[name];
		if (!dim){
			return false;
		}
		dim.filter(null)
		dc.redrawAll();
		this.filter_panel._chartFiltered(dim.top(1000000));
		dim.remove();
		delete this.filters[name];

	}

	addButton(text,func){
		let self=this;
		this.control_div.append($("<button>").attr("class","btn btn-sm btn-primary").css({"margin-left":"5px","height":"24px","padding":"0px 5px"}).text(text).click(function(e){
			func(self.data);
		}));

	}

	_filterChanged(data,filtered_items){
		this.data_view.addCustomFilter("ids",function(item){
			if (filtered_items[item.id]){
				return true;
			}
			return false;
		});
		this.data_view.filterData();
		this.image_table.show(1);

	}

	setListener(func){
		this.listener=func;
	}


	changeGraphFields(graph,new_field){
		let chart = this.filter_panel.charts[graph];
		chart.changeFields(new_field);
	}



}

export {CIView};