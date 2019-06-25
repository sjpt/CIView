import {FilterPanel,AddChartDialog}  from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {MLVImageTable,MLVImageTableControls} from "./image_table.js";
import {FilterPanelDataView,MLVSortDialog} from "./mlv_table.js";

class CIView{

	

	constructor(config){
		let self=this;

		this.filters={};
		this.columns=config.columns?config.columns:{};
		this.sort_columns=[];

		
		let div = $("#"+config.table_div);
		this.control_div=$("<div>").css({width:"100%",height:"26px"}).attr("id","civ-control").appendTo(div);
		let image_table_div= $("<div>").css({top:"25px",height:"calc(100% - 26px)"}).attr("id","civ-table").appendTo(div);
		let grid_div = $("<div>")
		this.filter_panel = new FilterPanel(config.filter_div,config.data,
							{
								menu_bar:true,
								graphs:config.saved_graphs
							});
		this.filter_panel.setColumns(this.columns);
		this.data_view =  new FilterPanelDataView(null,this.filter_panel);
		this.image_table =  new MLVImageTable(image_table_div,this.data_view,config.image_base_url);
		this.data = config.data;
		this.base_url = config.image_base_url;
		if (config.images){
			this.filter_panel.setConfigAttribute("images",config.images);
		}
		

		let ic =new MLVImageTableControls(this.image_table,this.control_div);

		
		for (let graph of config.graphs){
			this.filter_panel.addChart(graph.type,graph.params,graph.name,graph.id,graph.location);		
		}
		this.filter_panel.refresh();
		this.data_view.setItems(config.data);

		this.image_table.addListener("data_changed",function(field,data){
			self.filter_panel.dataChanged(field,true);
		});
		this.data_view.onRowsChanged.subscribe(function (e, args) {
         	self.image_table.show(1);
        });

        let sort_but = $("<i class='fas fa-sort-alpha-up'></i>").click(function(e){
        	self.showSortDialog();
        });
        ic.addElement(sort_but);
	}



	addGraph(panel_name,type,params,name){
		this.filter_panel.addChart(panel_name,type,params,name)
	}

	changeImageSize(percent){
		let val = percent/100;
		let app = this.image_table;
		let width = parseInt(app.img_width*val);
        let height= parseInt(app.img_height*val);
        app.setImageDimensions([width,height]);
        app.show();
        $("#mlv-it-image-slider").slider("value",percent);
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

	addIcon(icon){
		this.control_div.append(icon);
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

	showSortDialog(){
		let self = this;
		new MLVSortDialog(this.data_view,this.columns,this.sort_columns,
		function(sort_columns){
			self.sort_columns=sort_columns;
			self.image_table.show(1);
		})
	}

	showAddChartDialog(){
		let cols=[];
		let self=this;
		for (let i in this.columns){
			cols.push(this.columns[i]);
		}
		new AddChartDialog(cols,function(data){
    		self.filter_panel.addChart(data.type,data.param,data.label,null,{x:0,y:0,height:3,width:3});
    	},{base_url:this.base_url})
	}

}

export {CIView};