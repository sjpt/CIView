import {MLVDCChart,MLVChart,FilterPanel,MLVColorLegend} from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {d3} from "./vendor/d3.js";
import {VennDiagram,sortAreas} from "./vendor/venn/diagram.js";

let a_sets = ["A","B","C","D","E","F","G"];


class VennDiagramChart extends MLVChart{
    constructor(ndx,div,config,columns){
	    super(ndx,div,config);
        let self =this;
		this.reset_but.click(function(e){
            self._createFilter(null);
             d3.select("#"+self.div.attr("id")).selectAll("path").styles({"stroke-width":"5px","stroke-opacity":0,stroke:null});
            self.reset_but.css("visibility","hidden");
        }).appendTo(this.ti);
        this.dim= ndx.dimension(function(d){return d});
        this.calculateEmptySets();
	    this.type= "venn_diagram";
	    this.calculateAllSets(this.ndx.getOriginalData());
	    this.chart= VennDiagram();
		 this.chart= VennDiagram();
        this.setSize();
        
       
	}

	calculateEmptySets(){
		this.sets={};
		this.set_index={};
		for (let i=0;i<this.config.sets.length;i++){
			this.set_index[a_sets[i]]={name:this.config.sets[i].name,index:i};
			for (let s in this.sets){
				this.sets[s+a_sets[i]]=0;
			}
			this.sets[a_sets[i]]=0;
		}	
	}

	_hide(items,length){
       this.calculateAllSets(items);
       this.updateDiagram();


	}


	calculateAllSets(data){
		for (let s in this.sets){
			this.sets[s]=0;
		}
		for (let i in data){
			let item =data[i];
			let di={};
			for (let n=0;n<this.config.sets.length;n++){
				let s_info = this.config.sets[n];
		    		if (item[s_info.field]===s_info.value){
					let a_set= a_sets[n] 
					for (let i in di){
						di[i+a_set]=true;
					}
					di[a_set]=true;
				}
			}
		    	for (let d in di){
		    		this.sets[d]++;
		    	}
          }
          this.display_sets=[];
          for (let a_set in this.sets){
			let ts =a_set.split("");
			let indexes=[];
			for (let i  of ts){
				indexes.push(this.set_index[i].index)
			}
			let label=""
			let size = this.sets[a_set];
			if (ts.length==1){
                 label = `${this.set_index[ts[0]].name}(${size})`
			}
			else{
				label=size+"";
			}
			this.display_sets.push({sets:ts,size:size,indexes:indexes,a_set:a_set,label:label});
	    }
		
	}
	setSize(x,y){
		super.setSize(x,y);
		this.chart.height(this.height).width(this.width);
		this.updateDiagram();
		
	}
	updateDiagram(){
		let div = d3.select("#"+this.div.attr("id"));
	
		let self=this;
		div.datum(this.display_sets).call(this.chart);
			div.selectAll("text").attr("font-size","13px");
		 div.selectAll("g")
		 .on("click",function(d,i,g){
		 	    div.selectAll("path").styles({"stroke-width":"5px","stroke-opacity":0,stroke:null});
            	console.log(g);
            	d3.select(d3.event.target).styles({"stroke-width":"2px","stroke-opacity":1,stroke:"black"});
            	self._createFilter(d.indexes)
            }

	        )
            .on("mouseover", function(d, i) {
            	
            	sortAreas(div, d)
            	
            });
	}

	removeFilter(){
	    d3.select("#"+this.div.attr("id")).selectAll("path").styles({"stroke-width":"5px","stroke-opacity":0,stroke:null});
		this._createFilter(null,true);
	}


	_createFilter(indexes,not_propagate){
		let self =this;
		if (indexes == null){
			this.reset_but.css("visibility","hidden");
		    this.dim.filter(null);
		}
		else{
			this.reset_but.css("visibility","visible");
			
			this.dim.filter(function(d){
				for (let i of indexes){
					let rule= self.config.sets[i];
					if (d[rule.field]!==rule.value){
						return false
					}
				}
				return true;
				
			});

		
		}
		
	
		
		
		if (! not_propagate){
			dc.redrawAll();
            this.updateListener(this.dim.getIds(),this.config.id);
		}
	}	
}

MLVChart.chart_types["venn_diagram"] ={
		        "class":VennDiagramChart,
		        name:"VennDiagram",
		        params:[{name:"First Category",type:"text"},{name:"Second Category",type:"text"}]
}
