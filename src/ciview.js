import {FilterPanel}  from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {MLVImageTable,MLVImageTableControls} from "./image_table.js";
import {DataView} from "./vendor/slick.dataview.js";

class CIView{

	

	constructor(config){
		let self=this;

		this.filters={};

		this.data_view =  new DataView();
		let div = $("#"+config.table_div);
		this.control_div=$("<div>").css({width:"100%",height:"26px"}).attr("id","civ-control").appendTo(div);
		let table_div= $("<div>").css({top:"25px",height:"calc(100% - 26px)"}).attr("id","civ-table").appendTo(div);
		this.filter_panel = new FilterPanel(config.filter_div,config.data,function(info){
			self._filterChanged(info);
			if (self.listener){
				self.listener(info);
			}
		});
		this.image_table =  new MLVImageTable(table_div,this.data_view,config.image_base_url);
		this.data = config.data;

		new MLVImageTableControls(this.image_table,this.control_div);

		
		for (let item of config.graph_groups){
			this.filter_panel.addFilterSet(item.name,item.height_weight);
			for (let graph of item.graphs){
				this.filter_panel.addChart(item.name,graph.type,graph.params,graph.name);			
			}
		}
		this.filter_panel.refresh();
		this.data_view.setItems(config.data);

		this.image_table.addListener("data_changed",function(field,data){
			self.filter_panel.dataChanged(field,true);
		})

	}

	addFilterSet(name,config,div){
			this.filter_panel.addFilterSet(name,null,div);
			for (let graph of config){
				this.filter_panel.addChart(name,graph.type,graph.params,graph.name)
			}

	}


	removeFilterSet(name){
		this.filter_panel.removeFilterSet(name);
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

	_filterChanged(data){
		this.data_view.setItems(data);
		this.image_table.show(1);

	}

	setListener(func){
		this.listener=func;
	}



}

export {CIView};