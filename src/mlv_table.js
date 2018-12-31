import {SlickGrid}  from "./vendor/slick.grid.js";
import {DataView} from "./vendor/slick.dataview.js";
import {RowSelectionModel} from "./vendor/slick.rowselectionmodel.js";
import {Editors} from "./vendor/slick.editors.js"
$.fn.extend({
  dialogFix: function() {
    function _getElementHeight(el){
	let height= el.css("height");
	if (!height){
		return 0;
	}
	let a= parseInt(height.replace("px",""));
	return a;
	
}
    return this.each(function() {
      $(this).parent().find(".ui-dialog-titlebar-close").css("font-size","0px")
      $(this).on("dialogresize dialogresizestop",function(e,ui){

    	  let th=$(this);
    	  let pa= th.parent();
	      let title_height =_getElementHeight(pa.find(".ui-dialog-titlebar"));
	      let button_height = _getElementHeight(pa.find(".ui-dialog-buttonpane"));
	       let pa_height=_getElementHeight(pa);  
	       let h = (pa_height-title_height-button_height-10)+"px"   	   
            th.css({width:"auto",height:h});  
      });

    });
  }
});


class ContextMenu{
    constructor(func){
        let self=this;
        
        this.set_item_function=func;
        $("body").on("click.contextmenuhide",function(e){
            self._removeMenu()

        })

    }

    setItemFunction(func){
        this.set_item_function=func;
    }
    _removeMenu(){
        if (this.menu && this.menu.remove){
            this.menu.remove();
        }

    }

    show(data,e){
        //build menu
        this._removeMenu();
        let self =  this;
        this.menu=$("<ul>").css({position:"absolute",display:"none","z-index":1000}).appendTo($("body"));
        this.items= this.set_item_function(data);
        for (let item of this.items){
            let li = $("<li>");
            let div=$("<div>").css("hover","blue")
            .data("func",item.func)
            .text(item.text).click(function(e){
                $(this).data("func")(data);
                self._removeMenu();

            }).appendTo(li);
            li.appendTo(this.menu);
        }

        this.menu.css({top:e.clientY+"px",left:e.clientX+"px"}).menu().show();
        e.stopImmediatePropagation();

    }
}

class MLVTable{
    constructor(element_id,columns,data_view,extra_options){
        this._name="mlvtable_"+MLVTable.count;
        MLVTable.count++;
        this.element_id=element_id;
        this.filters=[];
        let options = {
            enableCellNavigation: true,
            enableColumnReorder: true,
            jQueryUiStyles: false,
            multiColumnSort: true,
            enableAsyncPostRender: true,
            enableAsyncPostRenderCleanup:true,
           
        };
        for (let o in extra_options){
            options[o]=extra_options[o];
        }
        
        this.data_view=data_view?data_view:new MLVDataView();
        

        this.parseColumns(columns,options);
      
        this.grid= new SlickGrid("#"+element_id,this.data_view,columns,options);
        //need to show any filter icons
      


    
        
        let self = this;
        this.listeners={
            "scroll_listener":[],
            "sort_listener":[],
            "row_clicked_listener":[]
        };
        this.scroll_timeout=null;
        this.scroll_timeout_length=200;
       
        this.data_view.onRowCountChanged.subscribe(function (e, args) {
            self.grid.updateRowCount();
            self.grid.render();
        });

        this.data_view.onRowsChanged.subscribe(function (e, args) {
            self.grid.invalidateRows(args.rows);
            self.grid.render();
        });
        this.grid.setSelectionModel(new RowSelectionModel());
        this._setupListeners();
        this.grid.setColumns(this.grid.getColumns());
    }

    destroy(){
        $(window).off("resize."+this._name);
    }


    loadData(url){
         let self = this;
        return new Promise(function(accept,reject){
           
            $.ajax({
                url:url,
                dataType:"json"
            })
            .done(function(data){
                self.data_view.setItems(data);
                self.resize();
                accept(data);
            });
        })

    }





    addListener(type,func){
        this.listeners[type].push(func);
    }

    parseColumns(columns,options){
        let self = this;
        for (let column of columns){
            if (column.filterable){
              this.data_view.addFilter(column);
                if (options.no_hide_filter){
                    column.formatter=function(row, cell, value, columnDef, dataContext){
                        let rtn = { text: value, removeClasses: 'slick-grid-danger slick-grid-success' }
                        if (!self.data_view.isFilterActive(columnDef.field)){
                            return rtn
                        }
                        if(dataContext._filters[columnDef.field]){
                            rtn.addClasses="slick-grid-danger"
                        }
                        else{
                            rtn.addClasses="slick-grid-success"
                        }
                        return rtn;
                    }
                }
           
            }
            if (column.editable){
                options.editable=true;
                if (column.datatype==="integer"){
                    column.editor=Editors.Integer;
                }
                else if(column.datatype==="double"){
                    column.editor=Editors.Float;
                }
                else if(column.datatype==="date"){
                    column.editor=Editors.Date;
                }
                else if(column.dataype==="boolean"){
                    column.editor=Editors.CheckBox;
                }
                else{
                    column.editor=Editors.Text;
                }

              
            }
        }

        if (options.no_hide_filter){
            let is_filtered_column={
                id:"_is_filtered",
                name:"Selected",
                field:"_is_filtered",
                datatype:"boolean",
                sortable:true,
                editor:Editors.InverseCheckbox,
                formatter:function(row, cell, value, columnDef, dataContext){
                    if (!value){
                        return "<i  style ='color:green' class='fas fa-check'></i>";
                    }
                    else{
                        return  "<i style ='color:red' class='fas fa-times'></i>";
                    }

                }
            }
            columns.unshift(is_filtered_column)
            options.editable=true;
            
        }

         //this.grid.setColumns(columns);
        

    }

    setValue(id,field,value){
        let item = this.data_view.getItemById(id);
        item[field] = value
        this.data_view.updateItem(id, item);
    }


    addColumn(name,label){
        let columns = this.grid.getColumns();
        let column = {id: "column"+(columns.length+1), name:label, field:name,sortable:true} 
        columns.push( column );
        this.grid.setColumns(columns);
    }
    
    getDataItem(n){
        return this.grid.getDataItem(n);
    }

    goToRow(row){
        this.grid.scrollRowIntoView(row);
    }

    getAllColumnFields(){
        let col_names=[];
        for (let col of this.grid.getColumns()){
            col_names.push(col.field)
        }
        return col_names;
    }


    getRowById(id){
        return this.grid.data_view.getRowById(id);
    }

    setDataItem(row,field,value){
        let item = this.grid.getDataItem(row);
        item[field] =value;
        this.data_view.updateItem(item.id, item);
    }

    getTopVisibleRow(){
         let vp = this.grid.getViewport();
         return vp.top;
    }

    getColumnDictionary(){
        let column_dict={};
        for (let col of this.grid.getColumns()){
            column_dict[col.field]=col.name;
        }
        return column_dict;
    }
    
    getRowNumber(){
        return this.grid.getDataLength();
    }

    getSelectedRows(){
        return this.grid.getSelectedRows();
    }

    getSelectedItems(){
        let rows = this.grid.getSelectedRows();
        let items=[];
        for (let row of rows){
            items.push(this.data_view.getItem(row));
        }
        return items;
    }
    
    setSelectedRows(rows){
        return this.grid.setSelectedRows(rows);
    }
    scrollRowIntoView(row){
        this.grid.scrollRowIntoView(row)
    }

    showFilterDialog(single_field){
       
        new MLVFilterDialog2(this.data_view,single_field,
                                ()=>{
                                    if (this.grid.getOptions().no_hide_filter){
                                        this.grid.invalidate();
                                    }
                                    this._updateFilterIcons()
                                },
                                this.grid.getOptions().no_hide_filter);
    }

    showDownloadDialog(columns){
        new MLVDownloadDialog(this.data_view,columns);
    }

    showSortDialog(){
        let cols = {};
        let self = this;
        for (let col of this.grid.getColumns()){
            if (col.sortable){
                cols[col.id]={name:col.name,field:col.field,datatype:col.datatype};
            }
        }
        new MLVSortDialog(this.data_view,cols,this.grid.getSortColumns(),
        function(sort_cols){
            self.grid.setSortColumns(sort_cols);
            self.grid.invalidate();
            self.grid.render();
            let vp = self.grid.getViewport();
            for (let func of self.listeners['sort_listener']){
                 func(vp.top,vp.bottom);
            }

        });
    }

    searchForValue(value){
        let row = this.data_view.searchData(value,this.getAllColumnFields());
        if (row !==-1){
            this.grid.scrollRowIntoView(row);
            this.grid.setSelectedRows([row]);
        }
        return row;


    }

    _updateFilterIcons(){
        for (let filter of this.data_view.filters){
            let icon = $("#grid-filter-icon-"+filter.field);
            if (filter.active){
                icon.addClass("grid-filter-icon-on");
                icon.removeClass("grid-filter-icon-off");
            }
            else{
                icon.addClass("grid-filter-icon-off");
                icon.removeClass("grid-filter-icon-on");             
            }
        }

  
    }
    
    _setupListeners(){

        let self =  this;

        this.grid.onSort.subscribe(function (e, args) {
            var cols = args.sortCols;
            self.data_view.sortData(cols);
            self.grid.invalidate();
            self.grid.render();
            let vp = self.grid.getViewport();
            for (let func of self.listeners['sort_listener']){
                 func(vp.top,vp.bottom);
            }
          });

       
      
        
        this.grid.onScroll.subscribe(function(e, args){
            clearTimeout(self.scroll_timeout);
            self.scroll_timeout=setTimeout(function(){
                let vp = self.grid.getViewport();
                for (let func of self.listeners["scroll_listener"]){                 
                    func(vp.top,vp.bottom);
                }
            },
            self.scroll_timeout_length);
        });

      this.grid.onClick.subscribe(function(e, args) {
           let dataItem = args.grid.getDataItem(args.row);
           let col=args.grid.getColumns()[args.cell];
             for (let func of self.listeners["row_clicked_listener"]){                 
                    func(dataItem,col,e);
             }
      });
     
    

       this.grid.onHeaderCellRendered.subscribe(function(e, args){
           let col =args.column
           if (col.filterable){
                let filter_icon=$("<i>").attr({id:"grid-filter-icon-"+col.field,class:"fa fa-filter grid-filter-icon grid-filter-icon-off"})
               .on("click", function(e) {
                    e.stopPropagation();
                    let field = $(this).attr("id").split("-")[3];
                    self.showFilterDialog(field);
                 });

                $(args.node).prepend(filter_icon);
           }
       });
    
        
        
        $(window).on("resize."+this._name,function() {
            setTimeout(function(){
                self.grid.resizeCanvas();
            },500);
        });
              
    }
    resize(){
    	this.grid.resizeCanvas();
    }

    _refreshFilterIcons(){
        let self =this;
        $(".grid-filter-icon").off().on
    }
       
}


MLVTable.count=0;


class MLVDataView extends DataView{
    constructor(data){   
        super(data);
        this.search_position=0;
        this._setupSorting();
        this.listeners={
            "data_filtered":new Map(),
        };
        this.custom_filters={};
        this.filtered_ids={};
    }

     addListener(type,func,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return null;
    	}
    	if (!id){
    		id = type+"_"+listener.size
    	}
    	listener.set(id,func);
    	return id;
    }

     /**
	* Removes a listener to the panel
	* @param {string} type - The type of listener - track_empty 
	* @param {string} id - The id of the handler to remove
	* @returns{boolean} true if the listener was removed, otherwise false 
	*/
    removeListener(type,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return false;
    	}
    	return listener.delete(id);
    }

    searchData(value,fields){
        let position=this.search_position;
        value = value.toUpperCase();
        let length=this.getLength();
        let found=false;
        let row =-1;
        do{
            let item = this.getItem(position);
            for (let field of fields){
                let item_val = item[field]+"";
                if (item_val){
                    if (item_val.toUpperCase().includes(value)){
                        found =true;
                        row=position;
                        this.search_position=position+1;
                        break;
                    }
                }

            }
            position++;
            if (position===length){
                position=0;
            }


        }while(position !== this.search_position);
        return row;

    }


    addCustomFilter(id,filter){
        this.custom_filters[id]=filter;
    }
    removeCustomFilter(id){
        delete this.custom_filters[id]
    }



    filterDataNoHide(){
        let items =this.getItems();
        let total_filtered=0;
        for (let item of items){
            item._filters={};
            item._is_filtered=false;
            for (let filter of this.filters){
                
               
                if (!filter.active){
                    continue;
                }
                let operand = filter.operand;
                if (filter.datatype=="text"){
                    if (operand=="="){
                        if(!(item[filter.field].toUpperCase()===filter.value.toUpperCase())){
                            item._filters[filter.field]=true;
                            item._is_filtered=true;
                        }
                    }
                    else if (operand=="!="){
                        if(item[filter.field].toUpperCase()===filter.value.toUpperCase()){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }

                    }
                    else if (operand==="contains"){
                         if(!(item[filter.field].toUpperCase().includes(filter.value.toUpperCase()))){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }
                    else if (operand==="not_contains"){
                        if(item[filter.field].toUpperCase().includes(filter.value.toUpperCase())){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }

                }
                else{
                    if (operand=="="){
                        if(!(item[filter.field]===filter.value)){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }
                    else if (operand=="!="){
                        if(item[filter.field]===filter.value){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }
                    else if (operand==">"){
                        if(item[filter.field]<filter.value){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }
                    else if (operand=="<"){
                        if(item[filter.field]>filter.value){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }
                    else if (operand=="between"){
                        if(!(item[filter.field]>=filter.value[0] && item[filter.field]<=filter.value[1])){
                             item._filters[filter.field]=true;
                             item._is_filtered=true
                        }
                    }
                }

            }
            if (item._is_filtered){
                total_filtered++;
            }

        }
       this.listeners.data_filtered.forEach((func)=>{func(total_filtered)});


    }


    clearAllFilters(){
        for (let filter of this.filters){
            filter.active=false;

        }
        this.custom_filters={};
    }

    _isItemFiltered(item){
          for (let filter of this.filters){
                if (!filter.active){
                    continue;
                }
                let operand = filter.operand;
                if (filter.datatype=="text"){
                    if (operand=="="){
                        if(!(item[filter.field].toUpperCase()===filter.value.toUpperCase())){
                            return false;
                        }
                    }
                    else if (operand=="!="){
                        if(item[filter.field].toUpperCase()===filter.value.toUpperCase()){
                            return false;
                        }

                    }
                    else if (operand==="contains"){
                         if(!(item[filter.field].toUpperCase().includes(filter.value.toUpperCase()))){
                            return false;
                        }
                    }
                    else if (operand==="not_contains"){
                        if(item[filter.field].toUpperCase().includes(filter.value.toUpperCase())){
                            return false;
                        }
                    }

                }
                else{
                    if (operand=="="){
                        if(!(item[filter.field]===filter.value)){
                            return false;
                        }
                    }
                    else if (operand=="!="){
                        if(item[filter.field]===filter.value){
                            return false;
                        }
                    }
                    else if (operand==">"){
                        if(item[filter.field]<filter.value){
                            return false;
                        }
                    }
                    else if (operand=="<"){
                        if(item[filter.field]>filter.value){
                            return false;
                        }
                    }
                    else if (operand=="between"){
                        if(!(item[filter.field]>=filter.value[0] && item[filter.field]<=filter.value[1])){
                            return false;
                        }
                    }
                }

            }
            return true;

    }


    filterData(){
        this.search_position=0;
        let self=this;
        this.setFilter(item=>{
     
            for (let name in this.custom_filters){
                if (!this.custom_filters[name](item)){
                    return false;
                }         
            }
            return this._isItemFiltered(item);
          
        });
        this.listeners.data_filtered.forEach((func)=>{func(self.getFilteredItems().length)});
    }

    _setupSorting(){
        let self = this;
        this.sort_functions={
            text:function sorterStringCompare(a, b) {
                    a=a.toUpperCase();
                    b=b.toUpperCase();
                    return (a === b ? 0 : (a > b ? 1 : -1));
            },
            integer:function sorterNumeric(a, b) {
                    a=parseFloat(a);
                    b=parseFloat(b);
                    return  (a === b ? 0 : (a > b ? 1 : -1));
            },      
            date:function sorterDateIso(a, b) {     
                        var date_a = new Date(a);
                        var date_b = new Date(b);
                        var diff = date_a.getTime() - date_b.getTime();
                        return  (diff === 0 ? 0 : (date_a > date_b ? 1 : -1));
            },
            boolean:function (a,b){
                if(a){
                    if (!b){
                        return 1;
                    }
                    return 0
                }
                else{
                    if (b){
                        return -1;
                    }
                    return 0;
                }
            }
        }
        self.sort_functions.double=self.sort_functions.integer;
    }

    downloadData(headers,config){

        if (!config){
            config={};
        }
        let name = config.name?config.name:"data.tsv";
       
        let delimiter=config.delimiter?config.delimiter:"\t";
        let rows=[]
        let cols=[];
        for (let header of headers){
            cols.push(header.name);
        }
        rows.push(cols.join(delimiter));

        for (let i=0;i<this.getLength();i++){
            let item = this.getItem(i);
            cols=[];
            for (let header of headers){
                let  val = item[header.field];
                if (val === undefined){
                    val="";
                }
                cols.push(val)
            }
            rows.push(cols.join(delimiter));


        }
        let data = new Blob([rows.join("\n")],{type:'text/plain'});
       
         let save = $("<a download></a>").appendTo($("#mlv-iv-control-panel"));
          
              let text_file = window.URL.createObjectURL(data); 
              save.attr("download",name);
              save.attr("href",text_file);
              save[0].click();


    }

  

    sortData(cols){
        let self=this;
         this.sort(function (dataRow1, dataRow2) {
                for (var i = 0, l = cols.length; i < l; i++) {
                    var field = cols[i].sortCol.field;
                    var sign = cols[i].sortAsc ? 1 : -1;
                    var func = self.sort_functions[cols[i].sortCol.datatype];
                    if (!func){
                        func=self.sort_functions.text
                    }
                    var value1 = dataRow1[field], value2 = dataRow2[field];
                    var result =func(value1,value2) * sign;
                    if (result !== 0) {
                        return result;
                    }
                }
                return 0;
            }); 
    }
}

class FilterPanelDataView extends MLVDataView{
    constructor(data,filter_panel){
        super(data);
        this.filter_panel=filter_panel;
        let self=this;
        this.filter_dimensions={};
        this.filter_panel.setListener(function(items,ids){
            self._filterByID(ids)
        })
    }

    _filterByID(ids){
        let self=this;
        this.setFilter(function(item){
            if (ids[item.id]){
                return true;
            }
            return false;
        });
        this.listeners.data_filtered.forEach((func)=>{func(self.getFilteredItems().length)});

    }

    filterData(){
        let self = this;
        for (let filter of this.filters){
            let dim = this.filter_dimensions[filter.field];
            //clear filter and dispose of dimension
            if (!filter.active){
                if (dim){
                    dim.filter(null);
                    dim.dispose();
                    delete this.filter_dimensions[filter.field]
                }
            }
        
            else{
                if (!dim){
                    dim = this._getDimension(filter.field);
                    this.filter_dimensions[filter.field]=dim;
                }
                else{
                    //is this necessary?
                    dim.filter(null)
                }

                let filter_function = null;
                if (filter.datatype==="text"){
                    filter_function=this._getTextFilterFunction(filter.operand,filter.value);
                }
                else{
                    filter_function=this._getNumberFilterFunction(filter.operand,filter.value);
                }
                dim.filter(filter_function);
            }
        }

        this.filter_panel.filterChanged();

    }

    _getDimension(field){
        return this.filter_panel.ndx.dimension(function(d){
            return d[field];
        });
    }

    _getTextFilterFunction(operand,value){
        return function(d){
             if (operand=="="){
                if(!(d.toUpperCase()===value.toUpperCase())){
                    return false;
                }
             }
             else if (operand=="!="){
                if(!(d.toUpperCase()===value.toUpperCase())){
                    return false;
                }
             }
             else if (operand==="contains"){
                if(!(d.toUpperCase().includes(value.toUpperCase()))){
                    return false;
                }
             }
             else if (operand==="not_contains"){
                if(d.toUpperCase().includes(value.toUpperCase())){
                   return false;
                }
             }
             return true;
        };
    }

    _getNumberFilterFunction(operand,value){
        return function(d){
            if (operand=="between"){
                if(!(d>=value[0] && d<=value[1])){
                    return false;
                 }
            }

            else if (operand=="="){
                if(!(d===value)){
                    return false;
                }
            }
            else if (operand=="!="){
                if(d===value){
                    return false;
                }
             }
             else if (operand==">"){
                if(d<value){
                    return false;
                }
             }
             else if (operand=="<"){
                if(d>value){
                    return false;
                }
             }
             return true                  
        }
    }

}

class MLVDownloadDialog{
    constructor(data_view,headers){
       let self = this
       this.div = $("<div>").attr("class","mlv-save-dialog");
       this.data_view=data_view;
       this.headers=headers;
       this.div.append($("<label>").text("Name:"));
       this.name= $("<input>").val("data.tsv").appendTo(this.div);
       this.div.append(name);
       this.div.append($("<label>").text("Format:"));
       let div = $("<div>")
       div.append($("<input>").attr({type:"radio",value:"tsv",checked:true,name:"mlv-file-type"}))
       div.append("<span>tsv</span>");
       div.append($("<input>").attr({type:"radio",value:"csv",name:"mlv-file-type"}));
       div.append("<span>csv</span>");
       this.div.append(div);

      
      
           let buttons=[
            {
                text:"Download",
                click:()=>{
                 self.download();
                  

                }
            },
            {
                text:"Cancel",
                click:()=>{
                        this.div.dialog("close");
                }
            }
        ];     
       
      
        this.div.dialog({
            autoOpen: true, 
            buttons:buttons,
            title:"Download Data",
            width:250,
            close: ()=>{
                this.div.dialog("destroy").remove();
            }
        }).dialogFix();
         $("input[name='mlv-file-type']").click(function(e){
            let val = self.name.val();
            let i = val.lastIndexOf(".");
            let new_val=val.substring(0,i)+"."+$(this).val();
            self.name.val(new_val);
       })
       
    }

   download(){
       let del={
           tsv:"\t",
           csv:","
       }
       let config ={
           delimiter:del[$("input[name='mlv-file-type']").val()],
           name:this.name.val()
       }
       this.data_view.downloadData(this.headers,config);

   }
}


class MLVSortDialog{
    constructor(data_view,all_columns,sort_columns,callback){
       this.div = $("<div>").attr("class", "mlv-sort-dialog");
       this.data_view=data_view;
       this.all_columns = all_columns;
       this.sort_columns=sort_columns;
       this.callback=callback;
       let buttons=[
            {
                text:"Sort",
                click:()=>{
                    let cols= this._sort();
                    if (this.callback){
                        this.callback(cols);
                    }
                  

                }
            },
            {
                text:"Close",
                click:()=>{
                        this.div.dialog("close");
                }
            }
        ];     
        this.div.dialog({
            autoOpen: true, 
            buttons:buttons,
            title:"Sort",
            width:250,
            height:200,
            close: ()=>{
                this.div.dialog("destroy").remove();
            }
        }).dialogFix();
        this._init();
    }


    _init(){
        let self= this;
        this.div.append($("<label>").text("Columns:"));
        this.list =$("<ul>").css({"list-style-type":"none","padding":"4px","margin":"4px"}).appendTo(this.div);
        this.list.sortable();
        this.column_select=$("<select>").appendTo(this.div);
        for (let id in this.all_columns){
           this.column_select.append($('<option>', {
	           value: id,
	           text: this.all_columns[id].name
	       }));   
        }

        for (let rec of this.sort_columns){
            this._addSortRecord(rec)
        }

        let add_but = $("<i>").attr("class","fas fa-plus").click(function(e){
            let id= self.column_select.val();
            self._addSortRecord({columnId:id,sortAsc:true});
            self.div.css("height","100%");
        }).appendTo(this.div);
       
    }


    _sort(){
       let sort_cols=[];
       let ret_sort_cols=[];
       let self = this;
       this.list.children().each(function(e){
           let id=$(this).data("id");
           let col= self.all_columns[id];
           let order=$(this).data("order");
           sort_cols.push({sortAsc:order==="ASC",sortCol:col});
           ret_sort_cols.push({sortAsc:order==="ASC",columnId:id});

       })
       this.data_view.sortData(sort_cols);
       return ret_sort_cols;
    }




    _addSortRecord(rec){
          let col = this.all_columns[rec.columnId];
          let li = $("<li>").data("id",rec.columnId);
          let text= $("<span>").text(col.name);
          let move_handle =$("<i class='fas fa-arrows-alt-v'></i>");
          let self=this;
          let select= $("<select>").append("<option>DESC</option><option>ASC</option>").css({float:"right"})
                      .on("change",function(e){  
                          $(this).parent().data("order",$(this).val());
                      });
          if (rec.sortAsc){
              select.val("ASC");
              li.data("order","ASC")
          }
          else{
              li.data("order","DESC")
          }
          let remove = $("<i class='fas fa-trash-alt'></i>").click(function(e){
              let p =  $(this).parent();
              let id =p.data("id");

              self.column_select.append($('<option>', {
	               value: id,
	               text: self.all_columns[id].name
	            }));   
             p.remove();
             self.div.css("height","100%");
          }).css({float:"right"}).appendTo(li);


          li.append(move_handle).append(text).append(select).appendTo(this.list);
          this.column_select.children().each(function(){
              let item=$(this);
              if (item.val()===rec.columnId){
                  item.remove();
              }
          })





       

    }
}




class MLVFilterDialog2{
    constructor(data_view,only_field,callback,no_hide){
        this.data_view=data_view;
        this.only_field=only_field;
        this.callback=callback;
        this.no_hide=no_hide;
        let number_options={
            ">":"greater than",
            "<":"less than",
            "=":"equals",
            "!=":"not equal",
            "<>":"between",
        }
        this.operand_dict={
            double:number_options,
            integer:number_options,
            "double precision":number_options,
            text:{
               "=": "equals",
               "contains":"contains",
               "!=":"does not equal",
               "not_contains":"not contains"
            }
        };
        var self=this;
        this.div = $("<div>").attr("class","mlv-filter-dialog");
        let buttons=[
            {
                text:only_field?"Clear":"Clear All",
                click:()=>{
                   
                   
                 
                    if (this.only_field){
                        
                        let filter=this.list1.find("li").data("filter")
                          
                        filter.off=true;
                        
                        
                        this._filter();
                        this.div.dialog("close");
                      
                        
                    }
                    else{
                         this.div.find("input[type=checkbox]").prop("checked",false);
                         this._filter();
                    }
                }
            },
            {
                text:"OK",
                click:()=>{
                        this.div.dialog("close");

                }
            }
        ];
        let width= only_field?300:550
        this.div.dialog({
            autoOpen: true, 
            buttons:buttons,
            title:"Filter",
            width:width,
             position: { my: "center", at: "top" },
            close: ()=>{
                this.div.dialog("destroy").remove();
                //this.callback();
            }
        }).dialogFix();

     
      
       this._addFilters(this.data_view.filters);
       if (only_field){
           this.div.find("label")[0].style.setProperty( 'margin-left', '0px', 'important' );
           this.div.find("select").css({float:"none","margin-left":"5px"});
       }  
    }

    _addFilters(filters){
        let self=this;
        if (!this.only_field){
        this.list1 =$("<ul>").css({"float":"left",width:"45%"}).appendTo(this.div);
        this.list2 =$("<ul>").css({"float":"right",width:"55%"}).appendTo(this.div);
        }
        else{
            this.list1=this.list2= $("<ul>").css({width:"100%"}).appendTo(this.div);
        }
        for (let filter of filters){
            if (this.only_field && filter.field != this.only_field){
                continue;
            }
            
            let row = $("<li>").data({filter:filter}).css({"margin":"10px 0px",position:"relative"});

            if (filter.datatype !=="text"){
                row.appendTo(this.list2)
                this._addNumberFilter(row,filter);
                
            }
            else{
                row.appendTo(this.list1);
                  let label = $("<label>").text(filter.label)
                  let operand =$("<select>");
                  let operands =this.operand_dict[filter.datatype];
                   for (let name in operands){
                        operand.append($('<option>', {
                        value: name,
                        text: operands[name]
                    }));
                }
                 operand.val(filter.operand)
                let value = $("<input type='text'>").val(filter.value);
              
               let div =$("<div>");
                 if (!this.only_field){
                    $("<input type='checkbox'>").prop("checked",filter.active).appendTo(div)
                    .click(function(e){
                        self._filter();
                    });
                }
                div.append(label).append(operand).appendTo(row);
                div=$("<div>").append(value).appendTo(row);
                let poss=[];
                for (let v in filter.info.values){
                    poss.push(v);
                }
                value.autocomplete({
                    source:poss,
                    select:function(event,ui){
                         $(this).parent().find("input[type=checkbox]").prop("checked",true);
                         $(this).val(ui.item.value);
                         self._filter();

                    }
                });

                value.on("blur keypress",function(e){
           
                    if (e.type==="keypress" && !(e.which===13)){
                        return;
                    }
                    $(this).parent().find("input[type=checkbox]").prop("checked",true);
                    self._filter()

                });
               
            }
        }

        if (!this.only_field){
            this.list1.sortable();
             this.list2.sortable();
        }
    }


    _addNumberFilter(li,filter){
        let min = parseFloat(filter.info.min);
        let max =parseFloat(filter.info.max);
        let range = max-min;
        let self=this;
        let s_max = range<5?max:Math.ceil(max);
        let s_min =range<5?min:Math.floor(min);
        let slider=  $("<div>").attr("class","mlv-filter-slider").slider({
              range: true,
               min: s_min,
               max: s_max,
               values: [filter.value[0],filter.value[1]],
               slide: function( event, ui ) {
                   let min1 =$(this).data("min");
                   if (min1<min){
                       min1=min;
                   }
                   min1.val(ui.values[0]);
                  
                   let max1= $(this).data("max");
                   if (max1<max){
                       max1=max;
                   }
                   max1.val(ui.values[1]);
                },
                stop:function(event,ui){
                    $(this).parent().find("input[type=checkbox]").prop("checked",true);
                    self._filter();
                }

        });

        if (range<5){
            slider.slider("option","step",(max-min)/50);
        }
     

         let min_input=$("<input>").attr("type","text").on("blur keypress",function(e){
                let t = $(this);
                if (e.type==="keypress" && !(e.which===13)){
                    return;
                }
                let v =t.val();
                v=parseFloat(v);
                if (v<min){
                    v=min;
                    t.val(v);
                }
                let min_max = slider.slider("option","values");
                slider.slider("option","values",[v,min_max[1]]);
                self._filter();
                
          }).width(60).val(filter.value[0]);

          let max_input=$("<input type='text'>").on("blur keypress",function(e){
                let t = $(this);
                if (e.type==="keypress" && !(e.which===13)){
                    return;
                }
                let v =t.val();
                v=parseFloat(v);
                if (v>max){
                    v=max;
                    t.val(v);
                }
                let min_max = slider.slider("option","values");
                slider.slider("option","values",[min_max[0],v]);
                self._filter();
                
          }).width(60).val(filter.value[1]);


          let label = $("<label>").text(filter.label);
          let div = $("<div>").css("position","relative").append(label);
          let span=$("<span>");
          span.append(min_input).append("<span style='font-weight:bold'>=&gt;&lt;=</span>")
                .append(max_input)
                .appendTo(div);
         li.append(div);
         if (!this.only_field){
             let check= $("<input type='checkbox'>").prop("checked",filter.active)
             .click(function(e){
                 self._filter();
             })
             div.prepend(check);
         }

         li.append(slider);
         slider.data({min:min_input,max:max_input});




    }
    _filter(){
        let self=this;
        let arr= [this.list1,this.list2];
        if (this.only_field){
            arr=[this.list1]
        }
        for (let list of arr){
        list.children().each(function(index){
            let row= $(this);
          
            let filter=row.data("filter");
            
            if (filter.datatype == "text"){
                let value = row.find("input[type=text]").val();
                filter.value=value;
                let operand = row.find("select").val();
                filter.operand=operand;
            }
            else {
                let sl = row.find(".mlv-filter-slider");
                let values = sl.slider("option","values");
                filter.value=[values[0],values[1]];
                filter.operand="between";
                filter.active=true;  
            }
            if (self.only_field){
                if (filter.off){
                    filter.active=false;
                    delete filter.off;
                }
                else{
                    filter.active=true;
                }
            }
            else{
                filter.active=row.find("input[type=checkbox]").prop("checked");
            }
       
        });
        }

        if (this.no_hide){
             this.data_view.filterDataNoHide();
        }
        else{
            this.data_view.filterData();
        }
        if (this.callback){
            this.callback();
        }
     
       
        
    }
}



class MLVFilterDialog{
    constructor(data_view,only_field,callback){
        this.data_view=data_view;
        this.only_field=only_field;
        this.callback=callback;
        let number_options={
            ">":"greater than",
            "<":"less than",
            "=":"equals",
            "!=":"not equal",
            "<>":"between",
        }
        this.operand_dict={
            double:number_options,
            integer:number_options,
            "double precision":number_options,
            text:{
               "=": "equals",
               "contains":"contains",
               "!=":"does not equal",
               "not_contains":"not contains"
            }
        };
        var self=this;
        this.div = $("<div>");
        let buttons=[
            {
                text:only_field?"Clear":"Clear All",
                click:()=>{
                    this.table.find("input[type=checkbox]").prop("checked",false);
                    this._filter();
                    if (this.callback){
                        this.callback();
                    }
                    if (this.only_field){
                        this.div.dialog("close");
                    }

                }
            },
            {
                text:"Filter",
                click:()=>{
                    this._filter();
                    if (this.callback){
                        this.callback();
                    }
                    if (this.only_field){
                        this.div.dialog("close");
                    }

                }
            }
        ];
        
        this.div.dialog({
            autoOpen: true, 
            buttons:buttons,
            title:"Filter",
            width:500,
            close: ()=>{
                this.div.dialog("destroy").remove();
            }
        });
      
       this._addFilters(this.data_view.filters);   
    }

    _addFilters(filters){
       this.table = $("<table>").attr("class","mlv-dialog-table");
        for (let filter of filters){
            if (this.only_field && filter.field != this.only_field){
                continue;
            }
            let row = $("<tr>").data({field:filter.field,label:filter.label,datatype:filter.datatype});
            let check = $("<input type='checkbox'>")
                    .prop("checked",filter.active)
            let label = $("<label>").text(filter.label)
            let operand =$("<select>");
            let operands =this.operand_dict[filter.datatype];
            for (let name in operands){
                operand.append($('<option>', {
                    value: name,
                    text: operands[name]
                }));
            }
            operand.val(filter.operand)
            let value = $("<input type='text'>").val(filter.value);
            
            $("<td>").append(check).appendTo(row);
            if (this.only_field){
                check.prop("checked",true).hide();
            }
            
            
            $("<td>").append(label).appendTo(row);
            $("<td>").append(operand).appendTo(row);
            $("<td>").append(value).appendTo(row);
            this.table.append(row);
            this.div.append(this.table);
        }
    }


    _addNumberFilter(){


    }
    _filter(){
        let filters=[];
        this.table.find("tr").each(function(index){
            let row= $(this);
            let datatype = row.data("datatype")
            let filter={
                field:row.data("field"),
                label:row.data("label"),
                active:row.find("input[type=checkbox]").prop("checked"),
                operand:row.find("select").val(),
                datatype:datatype
  
            };
            let value = row.find("input[type=text]").val();
            if (datatype == "text"){
                filter.value=value;
            }
            else {
                if (datatype == "double"){
                    filter.value = parseFloat(value);
                }
                else{
                    filter.value = parseInt(value);
                }
                if (isNaN(filter.value)){
                    filter.value="";
                }
            }
            filters.push(filter);


        });
        if (this.only_field){
            let count=0;
            for (let item of this.data_view.filters){
                if (item.field===filters[0].field){
                    break;
                }
                count++;
            }
            this.data_view.filters[count]=filters[0];
        }
        else{
            this.data_view.filters=filters;
        }
        this.data_view.filterData();
        
    }
}

export {MLVTable,MLVDataView,FilterPanelDataView,ContextMenu};