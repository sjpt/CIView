import {MLVChart,WGLScatterPlot,FilterPanel,MLVColorLegend} from "./graphs.js";
import {dc} from "./vendor/dc.js";
import {d3} from "./vendor/d3.js";
import {WGL2DI} from "./webgl/wgl2di.js";

class XyzScatterPlot extends WGLScatterPlot{

      _calculateRadius(){
      	 return super._calculateRadius()*2;  
      }

      createApp(){
        // let c = {
        // 	brush:this.config.brush,
        // 	circle_borders:false,
		// 	draw_options:{
		// 		depth:{enable:false},
		// 	    blend:{enable:true,
		// 		 func: {
        //           srcRGB: 'src alpha',
        //           srcAlpha: 1,
        //          dstRGB: 'one minus src alpha',
        //           dstAlpha: 1
        //       }
		//     }
		// 	}
		// }
        //this.app = new WGL2DI(this.graph_id,this.div.width(),this.div.height(),c);

        const xyz = this.makexyz();
        this.app = {addHandler: ()=>{}, setSize: (w,h) => xyz.setSize(w,h)};
        }
        addItems() {};

// make an xyz object under the given div (plotobj = this.div[0])
makexyz() { //##loc, plotobj) {

    const GG = window.GG;   // this gives access to various parts of xysviewer, to do by import later
    const plotobj = this.div[0];
    GG.plotobj = plotobj;

    // create a XYZ object and populate it with the captured data
    /* @type {XYZ} */ 
    let xyzobj = this.xyzobj = new GG.xyz.XYZ(undefined, 'fromMLV', true); 
    xyzobj.useJson(this.ndx.getOriginalData());

    // find the captured div, and display the domElement inside it
    const ch = plotobj.children;
    for (let i = 0; i < ch.length; i++) {
        if (ch[i].className !== 'mlv-chart-label')
            ch[i].style.display = 'none';
    }

    const cols = this.config.param;
    xyzobj.setField('X', cols[0], false);
    xyzobj.setField('Y', cols[1], false);
    xyzobj.setField('Z', cols[2], false);
    // xyzobj.setColor(this.config.color_by.column.id, false);

 
    xyzobj.setHostDOM(plotobj);
    const gb = xyzobj.gb;
    xyzobj.setSize(400,400);
    xyzobj.setBackground(1, 0.9, 0.9);
    // now done by setHostDOM
    // const renderer = gb.renderer;
    // hhh.addEventListener('resize', gb.onWindowResize);
    // gb.onWindowResize();
    // renderer.domElement.style.zIndex = 999;
    // renderer.domElement.style.position = 'relative';
    // // give access to our GUI, toggled by double-click on our canvas
    // renderer.domElement.ondblclick = () => E.xyzviewergui.style.display = E.xyzviewergui.style.display ? '' : 'none';

    // set up some sensible view etc
    gb.plan();
    // gb.orbcamera.position.set(0,0,3); // leave to default
    xyzobj.setPointSize(0.01)

    xyzobj.onFilter(ids => {
        this.dim.filter(function(d){ return ids[d]; }); 
        const xids = this.dim.getIds(); 
        this.updateListener(xids,this.config.id);
    });

    // handle incoming crossfilter
    this._filter = ids => xyzobj.filter(ids); // ???
    this._hide = ids => xyzobj.hide(ids);

    // colour change (field name only supported)
    this.colorByField = param => {
        if (param)
                xyzobj.setColor(param.column.id);
    }

    // point size
    this.setPointRadius = v => xyzobj.setPointSize(v/10);

    xyzobj.dataToMarkersGui();
    return xyzobj;
}


 	
    
			
	
}

MLVChart.chart_types["xyz_scatter_plot"] ={
		        "class":XyzScatterPlot,
		        name:"xyz Scatter Plot",
		        params:[
                    {name:"First Category",type:"text"},
                    {name:"Second Category",type:"text"},
                    {name:"Third Category",type:"text"}
                ],
		       
		    }

