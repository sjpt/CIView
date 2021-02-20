import {MLVChart,WGLScatterPlot,FilterPanel,MLVColorLegend, WGLChart} from "./graphs.js";
// import {dc} from "./vendor/dc.js";
// import {d3} from "./vendor/d3.js";
// import {WGL2DI} from "./webgl/wgl2di.js";

import {useXShader} from '../../xyz/xshader.js'
import {useLassoShader} from '../../xyz/lassoshader.js'
import {XYZ} from '../../xyz/xyz.js'

class XyzScatterPlot extends WGLScatterPlot {
    // none of the work done in WGLScatterPlot.init() is useful to us, and minmax part is expensive
    init() { this.type="xyz_scatter_plot"; }   

    createApp(){
        // config here ?
        //this.app = new WGL2DI(this.graph_id,this.div.width(),this.div.height(),c);

        const xyz = this.makexyz();

        // Martin to make this.app and addItems() more offical ... this was just to get it going
        this.app = {
            addHandler: ()=>{}, 
            setSize: (w,h) => xyz.setSize(w,h),
            remove: () => {}    // todo
        };
    }

    addItems() { this.type="xyz_scatter_plot" };

    // handle incoming crossfilter
    _filter(ids) { this.xyzobj.filter(ids); } // ???
    _hide(ids) { this.xyzobj.hide(ids); }

    // colour change (field name only supported, Martin to clarify column.id vs columns.field)
    colorByField(param) {
        if (param) this.xyzobj.setColor(param.column.id || param.column.field);
    }

    // point size
    setPointRadius(v) {this.xyzobj.setPointSize(v/10);}

    // make an xyz object under the given div element (plotobj = this.div[0])
    makexyz() {

        const GG = window.GG;           // this gives access to various parts of xysviewer, to do by import later
        const plotobj = this.div[0];    // find our parent
        GG.plotobj = plotobj;           // help debug

        window.lassoshaderbox.checked = false;   // later have cleaner way to stop xyz using full dataToMarkers
        window.xshaderbox.checked = false;   // later have cleaner way to stop xyz using full dataToMarkers
        // XYZ.baseguiset.filterbox = window.filterbox.value = '//fast'  // still not working, make part of new XYZ ?


        // create a XYZ object and populate it with the captured data
        let data = this.config.data;
        if (!data) data = this.ndx.getOriginalData();
        // if (!isNaN(data[0].___) data = 
        /* @type {XYZ} */ 
        let xyzobj = this.xyzobj = new XYZ(data, 'fromMLV', true); 
        // if (!this.config.data) {
        //     const data = 
        //     xyzobj.useJson(this.ndx.getOriginalData());
        // }

        // find the captured div, 
        // hide pre-made children (Martin to tidy?)
        // and display the domElement inside it
        const ch = plotobj.children;
        for (let i = 0; i < ch.length; i++) {
            if (ch[i].className !== 'mlv-chart-label')
                ch[i].style.display = 'none';
        }
        xyzobj.setHostDOM(plotobj);

        // tell xyz what fields to use
        const cols = this.config.param;
        xyzobj.setField('X', cols[0], false);
        xyzobj.setField('Y', cols[1], false);
        xyzobj.setField('Z', cols[2], false);
        xyzobj.setField('COL', cols[3], false);
        // xyzobj.setColor(this.config.color_by.column.id, false);

        // for now, done above by setting flags before the new XYZ
        // useXShader(true, undefined, xyzobj);
        // useLassoShader(true, undefined, xyzobj);    // use shader version for faster load
    
        xyzobj.setBackground(0.1);

        xyzobj.setPointSize(0.01)

        // handle outgoing crossfilter
        xyzobj.onFilter(ids => {
            this.dim.filter(function(d){ return ids[d]; }); 
            const xids = this.dim.getIds(); 
            this.updateListener(xids,this.config.id);
        });

        // // handle incoming crossfilter
        // this._filter = ids => xyzobj.filter(ids); // ???
        // this._hide = ids => xyzobj.hide(ids);

        // // colour change (field name only supported)
        // this.colorByField = param => {
        //     if (param)
        //             xyzobj.setColor(param.column.id);
        // }

        // // point size
        // this.setPointRadius = v => xyzobj.setPointSize(v/10);

        xyzobj.dataToMarkersGui();
        return xyzobj;
    }   // makexyz
	
}   // class XyzScatterPlot

MLVChart.chart_types["xyz_scatter_plot"] = {
    "class":XyzScatterPlot,
    name:"xyz Scatter Plot",
    params:[
        {name:"X",type:"number"},
        {name:"Y",type:"number"},
        {name:"Z",type:"number"},
        {name:"COL",type:"number"},
    ],
    // dialog:WGLScatterPlotDialog
    
}

