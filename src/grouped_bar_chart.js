import {MLVDCChart,MLVChart,FilterPanel,MLVColorLegend} from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {d3} from "./vendor/d3.js";

class GroupedBarChart extends MLVChart{
	constructor(ndx,div,config,columns){
		super(ndx,div,config);
        let self =this;
		this.reset_but.click(function(e){
                 self._createFilter(null);
                 self.reset_but.css("visibility","hidden");
             }).appendTo(this.ti);
        this.dim= ndx.dimension(function(d){return d.id});
		this.matrix={};
		let g1={};
		let g2={};
		for (let item of this.ndx.getOriginalData()){
			let g1_i = item[config.param[0]];
			let g2_i = item[config.param[1]];
			if (g1_i != null){
				 g1[g1_i]=true;
			}
			if (g2_i != null){
				g2[g2_i]=0;
			}
           
            
		}

		for (let c in g1){
			let item ={};
			for (let sf in g2){
				item[sf]=0;
			}
			this.matrix[c]=item
		}
        let g2_col=null
		for (let c of columns){
			if (c.field===config.param[0] && c.colors){
				this.config.g1_order=[]
				for (let cl of c.colors){
					this.config.g1_order.push(cl[0]);
				}
			}
		    if (c.field===config.param[1]){
		    	g2_col=c;
				this.config.g2_colors=c.colors
				
			}

		}
	
		let d = this.div.parent();
        let id = this.div.attr("id")+"-parent";
        d.attr("id",id);
		if (this.config.g2_colors){
			let items=[];
			for (let item of this.config.g2_colors){
                items.push({text:item[0],color:item[1]})
		    }
		    new MLVColorLegend(id,items,g2_col.name);

		}
		else{

			let cs= FilterPanel.getColorScale(g2_col,this.ndx.getOriginalData(),null,id);
			this.config.g2_colors=[];
			for (let v in cs.value_to_color){
				this.config.g2_colors.push([v,cs.value_to_color[v]]);
			}
		}



		if (!this.config.g1_order){
			this.config.g1_order=[];
			for (let n of this.matrix){
				this.config.g1_order.push(n);
			}
		}
		
		
		
		

		
		let data=[];
		for (let name of this.config.g1_order){
			let index=0;
			for (let n of this.config.g2_colors){
				data.push({
                       "g1":name,
                       "g2":n[0],
                       "color":n[1],
                       "index":index

				});
				index++;
			}
		}
		this.data=data;


		
		
		
        this.type= "grouped_bar_chart";
		var margin = {top: 0, right: 20, bottom: 30, left: 40};
        var width = this.div.width() - margin.left - margin.right;
        var height = this.div.height() - margin.top - margin.bottom-20;

  
        this.x = d3.scaleBand().padding(0.2);

        this.y = d3.scaleLinear()
        this.dim= ndx.dimension(function(d){return d});
       
          
        
        this.svg = d3.select(this.div[0]).append("svg")
        .attr("width", this.div.width())
        .attr("height", this.div.height());
        this.graph_area=this.svg
      .append("g")
        .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");
         this.graph_area.selectAll(".bar")
      .data(data)
        .enter().append("rect").attr("class", "bar")
        .on("click",function(d){
        	self._createFilter(d);
        });

        
      this.calculateGroups(this.ndx.getOriginalData());
      this.x.domain(this.config.g1_order);
      this.y.domain([0, this.max]);
      this.filtered_items=[];
      

 
     
      // add the x Axis
      this.x_axis=this.graph_area.append("g");
    

      // add the y Axis
      this.y_axis=this.graph_area.append("g");
      
     this.setSize();
	}

	removeFilter(){
		if (! this.filtered){
			return;
		}
		this._createFilter(null,true);
	}


	_createFilter(data,not_propagate){
		
		if (data == null){
			this.reset_but.css("visibility","hidden");
			delete this.filtered;
			this.filtered_items=[];
		    for (let item of this.data){
		    	delete item.is_filtered;
		    }
		    this.dim.filter(null);
		}
		else{
			this.reset_but.css("visibility","visible");
			if (data.is_filtered){
				this.filtered_items.splice(data.f_index,1);
				delete data.is_filtered
				if (this.filtered_items.length===0){
					this.filtered=false;
					this.dim.filter(null);
					this.drawBars(this.height-50);
					dc.redrawAll();
                    this.updateListener(this.dim.getIds(),this.config.id);
		
				}

			}
			else{
				this.filtered=true;
				data.is_filtered=true;
				data.f_index=this.filtered_items.length;
			    this.filtered_items.push([data.g1,data.g2])
			   
			}

			
		
			let g1 = this.config.param[0];
			let g2 = this.config.param[1];
			let self =this;
			this.dim.filter(function(d){
				let filter =false;
				for (let f of self.filtered_items)
				if (d[g1] === f[0] && d[g2]===f[1]){
					filter=true;
					break;
				}
				return filter;
			});
		
		}
		if (data==null){
			this._hide(this.dim.getIds().items);
		}
		else{
			this.drawBars(this.height-50);
		}

		
		
		if (! not_propagate){
			dc.redrawAll();
            this.updateListener(this.dim.getIds(),this.config.id);
		}
	}

	remove(){
        this.dim.filter(null);
        let left  = this.dim.getIds();
        this.dim.dispose();
        this.div.remove();
        return left;
    }


	calculateGroups(data,reset){
		if (reset){
			for (let a in this.matrix){
				let it= this.matrix[a];
				for (let t in it){
					it[t]=0;
				}
			}
		}
		let max=0;
		let g1= this.config.param[0];
		let g2= this.config.param[1];
		for (let index in data){
			let item = data[index];
			if (item[g1]==null || item[g2]==null){
				continue;
			}
			this.matrix[item[g1]][item[g2]]++;
			max = Math.max(this.matrix[item[g1]][item[g2]],max);

		}
		this.max=max;
		this.y.domain([0,max])
	}


	_hide(items,length){
		/*if (this.filtered){
			return;
		}*/
        this.calculateGroups(items,true);
        this.y.domain([0,this.max]);
        this.y_axis.transition().call(d3.axisLeft(this.y));
        //this.y_axis.call(y));
        this.drawBars(this.height-50,true,length===0);
	}

	remove(){
        this.dim.filter(null);
        let left  = this.dim.getIds();
        this.dim.dispose();
        this.div.remove();
        return left;
    }


	drawBars(height,animate,none){
	    let self =this;
        let t_width=this.x.bandwidth()/this.config.g2_colors.length;
        let trans = null;
        if (animate){
	        trans = d3.transition()
            .duration(400).ease(d3.easeLinear);
        }
	       this.graph_area.selectAll(".bar").transition(trans)
      .attr("x", function(d) 
      {
      	  return self.x(d["g1"])+(d.index*t_width)

       })
      .attr("width", t_width)
      .attr("fill",function(d){
      	    if (!self.filtered){
      	           return d.color;
      	    }
      	    return d.is_filtered?d.color:"lightgray";
      })
      .attr("y", function(d) {
      	 return self.y(self.matrix[d["g1"]][d["g2"]])
      	  })
      .attr("height", function(d) {
      	if (none){
      		return 0;
      	}
      	 return height - self.y(self.matrix[d["g1"]][d["g2"]]);
      	 });


	}
		setSize(x,y){
           super.setSize(x,y)
		let height=this.height;
		let width = this.width;
		this.svg 
        .attr("width", width)
        .attr("height", height)	
		this.x.range([0, width-60])
        this.y.range([height-50,0]);
        this.drawBars(height-50);
        this.y_axis.call(d3.axisLeft(this.y));
        this.x_axis
      .attr("transform", "translate(0," + (height-50) + ")")
      .call(d3.axisBottom(this.x));
	}


	
}

MLVChart.chart_types["grouped_bar_chart"] ={
		        "class":GroupedBarChart,
		        name:"Grouped Bar Chart",
		        params:[{name:"First Category",type:"text"},{name:"Second Category",type:"text"}],
		       
		    }



