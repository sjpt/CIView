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

    _addItem(item,parent,data){
        let self =this;
          let div=$("<div>");
            if (item.ghosted){
              div.css({"color":"lightgray"})
          }

           div.data("func",item.func)
            .text(item.text).click(function(e){
                if (!item.ghosted){
                    $(this).data("func")(data);
                    self._removeMenu();
                }

            }).appendTo(parent);
          if (item.icon){
              div.append($("<i>").attr("class",item.icon+" mlv-cm-icon"));
          }
         
    }

    show(data,e){
        //build menu
        this._removeMenu();
        let self =  this;
        this.menu=$("<ul>").css({position:"absolute",display:"none","z-index":1000}).appendTo($("body"));
        this.items= this.set_item_function(data);
        for (let item of this.items){
            let li = $("<li>").appendTo(this.menu);
            if (item.subitems){
                li.appendTo(this.menu);
                $("<div>").text(item.text)
                    //.append("<i class='fa fa-caret-right'></i>")
                    .appendTo(li);
                let sub_list=$("<ul>").appendTo(li);
                for (let subitem of item.subitems){
                    let s_li=$("<li>").appendTo(sub_list);
                    this._addItem(subitem,s_li);
                }
            }
            else{
                this._addItem(item,li,data)
            }
          
          
        }

       

        this.menu.css({top:e.clientY+"px",left:e.clientX+"px"}).menu().show();
         $(".ui-menu-item-wrapper").find("span").attr("class","fa fa-caret-right").css("float","right");
        e.stopImmediatePropagation();

    }
}

class MLVTable{
    constructor(element_id,columns,data_view,extra_options){
        this._name="mlvtable_"+MLVTable.count;
        MLVTable.count++;
        this.element_id=element_id;
        this.filters=[];
        this.tag_color_palletes={};
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
        this.buildColumnOrder();
        //need to show any filter icons


       
      


    
        
        let self = this;
        this.listeners={
            "scroll_listener":new Map(),
            "sort_listener":new Map(),
            "row_clicked_listener":new Map()
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
         if (this.has_column_groups){
              this.grid.init();
            this.setUpGroupPanel();
            this.updateGroupPanel();
           this.grid.onColumnsResized.subscribe(function(e, args){
               self.updateGroupPanel();
          
       });
           this.grid.onColumnsReordered.subscribe(function(e, args,c){
               self.buildColumnOrder();
          
       });
        this.grid.onColumnsResized.subscribe(function(e, args){
             
             
             
                   let cols= this.getColumns();
                   for (let c of cols){
                     self.column_index[c.field].width=c.width;
                  }
            

          
       });

           
        }
    }

    destroy(){
        $(window).off("resize."+this._name);
    }

    sortTable(sort_cols){
        this.data_view.sortData(sort_cols);

        let sc=[];
        for (let c of sort_cols){
            sc.push({sortAsc:c.sortAsc,columnId:c.sortCol.id})
        }
         this.grid.setSortColumns(sc);
         this.grid.invalidate();
         this.grid.render();
         let vp = this.grid.getViewport();
         this.listeners.sort_listener.forEach((func)=>{func(vp.top,vp.bottom)});
    }

    getColumnLayout(){
        let cols =  this.grid.getColumns();
        let col_info={};
        let groups= this.column_groups;
        let widths={};
        for (let n in this.column_index){
            widths[n]=this.column_index[n].width;
        }
        let order=[];
        for (let c of cols){
            order.push(c.field);
        }
        return {
            groups:groups,
            order:order,
            widths:widths
        }
    }


    setColumnLayout(layout){

    }



    getSortColumns(){
        let cols = this.grid.getSortColumns();
        let all_cols = this.grid.getColumns();
        let ret_cols=[];
        for (let c of cols){
            let t_c = all_cols[this.grid.getColumnIndex(c.columnId)];
            if (!t_c){
                continue;
            }
            ret_cols.push({
                sortCol:{
                    datatype:t_c.datatype,
                    name:t_c.name,
                    field:t_c.field,
                    id:t_c.id
                },
                sortAsc:c.sortAsc
            })
        }
        return ret_cols;


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


    taggingStarted(tagger){
        this.tagger=tagger;
        //this.temp_model = this.grid.getSelectionModel(); 
        //this.grid.setSelectionModel(null);
        let columns = this.grid.getColumns();
        for (let col of columns){
            if (col.field===tagger.field){
                col.formatter= function(a,b,c){
                    let color = tagger.options[c]
                    if (!color){
                        return c
                    }
                    return "<div style='width:100%;background-color:"+color+"'>"+c+"</div>";
                }
                break;
            }

        }
        this.grid.setColumns(columns);
    }

    tagAll(){
        let items = this.data_view.getFilteredItems();
        let option = this.tagger.selected_option;
        if(!option){
            return;
        }
        let field = this.tagger.field
        if (option==="None"){
            option=null;
        }
        for (let item of items){
            if (option){
                item[field]=option
            }
            else{
                delete item[field];
            }
        }
        this.data_view.listeners.data_changed.forEach((func)=>{func(field)});
        this.grid.invalidate();
        this.grid.render();
    }

    deleteTag(tag){
        let items = this.data_view.getItems();
        let field = this.tagger.field;
        for (let item of items){

            if (item[field]===tag){
                delete item[field];
            }
        }
        this.grid.invalidate();
        this.grid.render();
        
    }

    updateTags(){
        this.grid.invalidate();
        this.grid.render();
    }


    taggingStopped(){
        let columns = this.grid.getColumns();
        for (let col of columns){
            if (col.field===this.tagger.field){
               delete col.formatter
               break;
            }

        }
        this.grid.setColumns(columns);
        this.tagger=null;
        delete this.last_tagged;
        //this.grid.setSelectionModel(this.temp_model);
        //delete this.temp_model;
         
    }

    tagSelected(){
        this.setTags(this.grid.getSelectedRows());
    }

    setTags(rows){
        let field = this.tagger.field;
        for (let row of rows){
            let item = this.grid.getDataItem(row);
            if (this.tagger.selected_option==="None"){
                delete  item[field]
            }
            else{
                item[field]=this.tagger.selected_option;
            }
        }
        this.grid.invalidateRows(rows);
        this.grid.render();
        this.data_view.listeners.data_changed.forEach((func)=>{func(field)});
    
    }





    addListener(type,func,id){
        let listener = this.listeners[type];
    	if (!listener){
    		return null;
    	}
    	if (!id){
    		id=Math.round(Math.random()*100000)+""
    	}
    	listener.set(id,func);
    	return id;
    }

    removeListener(type,id){
    	let listener = this.listeners[type];
    	if (!listener){
    		return false;
    	}
    	return listener.delete(id);
    }

    parseColumns(columns,options){
        let self = this;
        this.column_index={};
        this.column_groups={};

        for (let column of columns){
            this.column_index[column.field]=column;

            if (column.columnGroup){
                let gr = this.column_groups[column.columnGroup];
                if (!gr){
                    gr = {columns:[]};
                    this.column_groups[column.columnGroup]=gr;
                }
                this.has_column_groups=true;
                if (column.master_group_column){
                    gr.master_column=column.field;
                    gr.expanded=false;
                }
                else{
                    gr.columns.push(column.field)
                }
            }

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

                },
                write_formatter:function(value){
                    return !value;
                }
            }
            columns.unshift(is_filtered_column)
            options.editable=true;
            
        }

        
    
        

	  if (options.has_column_groups){
		this.has_column_groups=true;
           delete options.has_column_groups;
	  }


        if (this.has_column_groups){
              options.createPreHeaderPanel= true;
              options.showPreHeaderPanel = true,
              options.preHeaderPanelHeight =23;     
        }

       
 

    }



    setColumnLayout(layout){
        for (let cn  in layout.widths){
            if (this.column_index[cn]){
                this.column_index[cn].width=layout.widths[cn];
            }
        }
        this.column_groups=layout.groups;
        let cs= this.grid.getColumns();
        let cols=[];
        for (let n of layout.order){
            cols.push(this.column_index[n]);
        }
        this.grid.setColumns(cols);
        this.buildColumnOrder();
     
    } 


    buildColumnOrder(extra_cols,delete_cols){
        if (!this.has_column_groups){
            return;
        }
        let cols = this.grid.getColumns();
        //get the order from the grid
        if (!(extra_cols) && !(delete_cols)){
            let col_orders=[];
            for (let g in this.column_groups){
                col_orders[g]=[];
            }


           
            for (let c of cols){
                if (c.columnGroup && !c.master_group_column){
                    col_orders[c.columnGroup].push(c.field)
                }
            }

            for (let g in col_orders){
                if (col_orders[g].length>0){
                    this.column_groups[g].columns=col_orders[g];
                }

            }
        }
        let already_groups={};
      
        let new_order = [];
        for (let c of cols){
           
            let gr = c.columnGroup;
            if (gr){
                if (already_groups[gr]){
                    continue;
                }
                let g= this.column_groups[gr];
                if (!g){
                    continue;
                }
                if (g.master_column){
                    new_order.push(this.column_index[g.master_column]);
                }
                if (g.expanded || !(g.master_column)){
                    for (let f of g.columns){
                        new_order.push(this.column_index[f]);
                    }
                        
                }
                already_groups[gr]=true;
            }
            else{
                if (delete_cols && delete_cols.indexOf(c.field)!==-1){
                    continue
                }
                else{
                    new_order.push(c);
                }
               
            }


        }
        for (let g in this.column_groups){
            if (!already_groups[g]){
                let gr = this.column_groups[g];
                if (gr.master_column){
                    new_order.push(this.column_index[gr.master_column]);
                }
                if (gr.expanded || !(gr.master_column)){
                    for (let f of gr.columns){
                        new_order.push(this.column_index[f]);
                    }
                        
                }
            }
        }
        if (extra_cols){
            for (let c of extra_cols){
                new_order.push(c);
            }
        }
        this.grid.setColumns(new_order);
        this.updateGroupPanel();
        this._updateFilterIcons()

    }

    expandCollapseGroup(group_name){
        let g=  this.column_groups[group_name];
        g.expanded=!g.expanded;
        this.buildColumnOrder();
       
    }

    removeColumns(fields){
        let delete_fields=[];
        for (let f of fields){
            let c= this.column_index[f];
            if (!c){
                continue;
            }
            if (c.columnGroup){
                let g = this.column_groups[c.columnGroup];
                if (c.master_group_column){
                    g.master_column="__replace"
                }
                else{
                    g.columns.splice(g.columns.indexOf(f),1);
                }
            }
            else{
                delete_fields.append(f)
            }
       }
       let g_delete=[];
       for (let g in this.column_groups){
           let gr = this.column_groups[g];
           if (gr.master_column==="__replace"){
               if (gr.columns.length===0){
                   g_delete.push(g)
               }
               else{
                   gr.master_column=gr.columns[0];
                   this.column_index[gr.columns[0]].master_group_column=true;
                   gr.columns.splice(0,1);
               }
           }
           else if (gr.columns.length===0 && !(gr.master_column)){
               g_delete.push(g);
           }

       }
       for (let g of g_delete){
           delete this.column_groups[g];
       }
       let needs_filtering=false;
       let filters=[];
       for (let f of this.data_view.filters){
            if (fields.indexOf(f.field)){
                if (f.active){
                    needs_filtering=true;
                } 
            }
            else{
                filters.push(f)
            }
        }

        this.data_view.filters=filters;
        for (let f of fields){
            delete this.column_index[f];
        }
        this.buildColumnOrder(null,delete_fields);
      
     
      
   
        if (needs_filtering){
            this.data_view.filterData();
            this.grid.invalidate();
        }
       

       
      
    }

    addColumns(cols,collapse){
        let new_groups={};
        let extra_cols=[];
        for (let column of cols){
            if (this.column_index[column.field]){
                continue;
            }
            if (!column.id){
                column.id=column.field;
            }
            if(column.filterable){
                this.data_view.addFilter(column);
            }
            if (column.columnGroup){
                let gr = this.column_groups[column.columnGroup];
                new_groups[column.columnGroup]=true;
                if (!gr){
                    gr= {columns:[],expanded:!collapse}
                    this.column_groups[column.columnGroup]=gr;
                }
          
                if (column.master_group_column){
                    gr.master_column=column.field;
                    
                }
                else{
                    gr.columns.push(column.field)
                }
               
            }
            else{
                extra_cols.push(column);
            }
            this.column_index[column.field]=column;
            
        }
        this.buildColumnOrder(extra_cols);
      
        
    }


    updateGroupPanel(){
        let $preHeaderPanel = $(this.grid.getPreHeaderPanel())
            .width(this.grid.getHeadersWidth())
            .empty();
        let self =this;
        let headerColumnWidthDiff = this.grid.getHeaderColumnWidthDiff();
        let m, header, lastColumnGroup = '', widthTotal = 0;
        let columns = this.grid.getColumns();
        let current_group=null;
        let current_group_index=0;
        for (var i = 0; i < columns.length; i++) {
             current_group_index++;
            m = columns[i];
 
            if (lastColumnGroup === m.columnGroup && i>0) {
                widthTotal += m.width;
                header.width(widthTotal - headerColumnWidthDiff);
               

            } else {
                if (lastColumnGroup  && current_group_index !==1 &&current_group_index<=this.column_groups[lastColumnGroup].columns.length){
                    console.log("column in wrong place")
                }
                widthTotal = m.width;
                header = $("<div class='ui-state-default slick-header-column' />")
                    .html("<span class='slick-column-name'>" + (m.columnGroup || '') + "</span>")
                    .width(m.width - headerColumnWidthDiff)
                    .appendTo($preHeaderPanel);
                let gr =this.column_groups[m.columnGroup];
                if (gr && gr.master_column){
                    let icon="<i class='fas fa-plus-circle'></i>";
                    if (gr.expanded){
                        icon="<i class='fas fa-minus-circle'></i>"
                    }
                    let el = $(icon).data("group",m.columnGroup)
                        .click(function(e){
                            self.expandCollapseGroup($(this).data("group"))
                        });
                  header.prepend(el);
                  current_group_index=0;
                       
                }
           }
        lastColumnGroup = m.columnGroup;
        }
     /* let group_headers= $(".slick-preheader-panel").children();
     group_headers.sortable({
        containment: "parent",
        distance: 3,
        axis: "x",
        cursor: "default",
        tolerance: "intersection",
        helper: "clone",
          placeholder: "slick-sortable-placeholder ui-state-default slick-header-column",
        start: function (e, ui) {
              ui.placeholder.width(ui.helper.outerWidth() - headerColumnWidthDiff);
          $(ui.helper).addClass("slick-header-column-active");
        },
        beforeStop: function (e, ui) {
        
        },
        stop: function (e) {
             var j = group_headers.children();
             j.each(function(index,el){
                 console.log(index,el);
             })

  
        }
      });*/
    }

    setUpGroupPanel(options){
        let $preHeaderPanel = $(this.grid.getPreHeaderPanel())
            .addClass("slick-header-columns")
            .css({'left':'-1000px'});
        
        $preHeaderPanel.parent().addClass("slick-header-columns");
      
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

    getTopVisibleItem(){
         return this.grid.getDataItem(this.getTopVisibleRow());
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
       
        new MLVFilterDialog(this.data_view,single_field,
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
        let cols=[];
        let self =this;
        for (let c of this.grid.getColumns()){
            if (c.sortable){
                cols.push(c);
            }
        }
        new MLVSortDialog(cols,this.getSortColumns(),
        function(sort_cols){
           self.sortTable(sort_cols);
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

    resetAllFilters(){
        this.data_view.resetAllFilters();
        this._updateFilterIcons();
        $(".mlv-filter-dialog").dialog("close")
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
            self.sortTable(cols);
          });

       
      
        
        this.grid.onScroll.subscribe(function(e, args){
            clearTimeout(self.scroll_timeout);
            self.scroll_timeout=setTimeout(function(){
                let vp = self.grid.getViewport();
                self.listeners.scroll_listener.forEach((func)=>{func(vp.top,vp.bottom)});
               
            },
            self.scroll_timeout_length);
        });

      this.grid.onClick.subscribe(function(e, args) {
           self.grid.tagging_field_clicked= self.tagger && self.grid.getColumns()[args.cell].field==self.tagger.field;
           let dataItem = args.grid.getDataItem(args.row);
           let col=args.grid.getColumns()[args.cell];
           self.listeners.row_clicked_listener.forEach((func)=>{func(dataItem,col,e)});
          
      });

      this.grid.onSelectedRowsChanged.subscribe(function (e, args) {
		  if (self.tagger && self.tagger.selected_option){
               if (self.grid.tagging_field_clicked){
                self.setTags(args.rows);
               }
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
        super();
        this.search_position=0;
        this._setupSorting();
        this.listeners={
            "data_filtered":new Map(),
            "data_changed":new Map()
        };
        this.custom_filters={};
        this.filtered_ids={};
        if (data){
            this.setItems(data);
        }
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

    resetAllFilters(){
        for (let filter of this.filters){
            filter.active=false;
		 if (filter.datatype!=="text"){
              filter.info={max:Number.MIN_SAFE_INTEGER,min:Number.MAX_SAFE_INTEGER}
            }
            else{
              filter.datatype={values:{}}
           }
        }
        this.custom_filters={};
     }


    getFilters(){
        let filters=[];
        for (let filter of this.filters){
            if (!filter.active){
                contine
            }
            filters.push({field:filter.field,operand:filter.operand,value:filter.value})
        }
        return filters; 
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
                    a=a?a:"";
                    b=b?b:"";
                    a=a.toUpperCase();
                    b=b.toUpperCase();
                    return (a === b ? 0 : (a > b ? 1 : -1));
            },
            integer:function sorterNumeric(a, b) {
                    a=parseFloat(a);
                    b=parseFloat(b);
                    if (isNaN(a)){
                        a= Number.MIN_SAFE_INTEGER;
                    }
                    if (isNaN(b)){
                        b= Number.MIN_SAFE_INTEGER;
                    }
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
                if (header.write_formatter){
                    val= header.write_formatter(val);
                }
                cols.push(val)
            }
            rows.push(cols.join(delimiter));


        }
        let data = new Blob([rows.join("\n")],{type:'text/plain'});
       
         let save = $("<a download></a>").appendTo("body");
          
              let text_file = window.URL.createObjectURL(data); 
              save.attr("download",name);
              save.attr("target","_blank")
              save.attr("href",text_file);
              save[0].click();
        save.remove();


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

    getMinMax(field){
        
        let max = Number.MIN_SAFE_INTEGER;
        let min = Number.MAX_SAFE_INTEGER;


        for (let item of this.getItems()){
            if (isNaN(item[field])){
                continue;
            }

            if (item[field]>max){
                max=item[field];
            }
            if (item[field]<min){
                min=item[field]
            }


        }
        return [min,max];
        
    }



    groupAndOrder(field,max_values){        
        let t_dict={}
        for (let item of this.getItems()){
            let q= t_dict[item[field]];
            if (!q){
                t_dict[item[field]]=1;
            }
            else{
                t_dict[item[field]]++;
            }
        }
        let arr=[];
        for (let v in t_dict){
            arr.push({"value":v,"count":t_dict[v]})
        }
        arr.sort(function(a,b){
            return b.count-a.count;
        });
        let ret_arr=[];
        let max=arr.length;
        if (max_values){
            if (max_values<arr.length){
                max=max_values;
            }
        }
        for (let n=0;n<max;n++){
            ret_arr.push(arr[n].value)
        }
        return ret_arr;

    }

    
}

class FilterPanelDataView extends MLVDataView{
    /**
    * Creates a data view which synchs with the filter panel provided
    * @param {Array} data - The list of objects (field to value)
    * @param {Object} data - The filter panel. The view will automatically
    * update the filter panel when filtered and will update if the
    * the filter panel is updated.
    */
    constructor(filter_panel){

        super();
        let data = filter_panel.ndx.getOriginalData();
        let copy=[]
        for (let item of data){
            copy.push(item);
        }
        this.setItems(copy);
        this.filter_panel=filter_panel;
        let self=this;
        this.filter_dimensions={};
        this.filter_listener = this.filter_panel.addListener(function(ids){
            self._filterByID(ids)
        });
        this.data_listener = this.addListener("data_changed",function(field){
            self. filter_panel.dataChanged(field);
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
        if (!this.dim){
            this.dim=this.filter_panel.ndx.dimension(function(d){
                return d.id;
            });
        }

        let i_dict={};
        let items = this.getItems();

        for (let item of items){
           if (this._isItemFiltered(item)){
               i_dict[item.id]=true;
           }
        }
        this.dim.filter(function(d){
            return i_dict[d];
        }); 
        this.filter_panel.updateDCCharts();
        this.filter_panel._chartFiltered(this.dim.getIds());

    }


    /**
    * Updates the filter on the supplied field to reflect the changed data
    * Does nor actually filter the data - use filterData()
    * @param {string} field - The field whose values have changed in the data
    */

    dataChanged(field){
        

    }
    
    /**
    * Gets the data from the view but ignores the filter on the supplied field
    * Does nor actually update the data just rerturns items
    * @param {string} field - The field on which not to filter
    * @returns {Array} - An array of data items 
    */
    getDataUnfilter(field){
        let items= this.getItems();
        let filter= null;
        for(let f of this.filters){
            if(field===field){
                filter=f;
                break;
            }
        }
        
         if (!(filter) || !(filter.active)){
             return items ;
         }
         filter.active=false;
         let f_items=[];
         for (let item of items){
          if (this._isItemFiltered(item)){
              f_items.push(item)
           }
            }
         filter.active=true;
         return f_items;

    }

    _getFilterFunction(filter){
         let filter_function = null;
         if (filter.datatype==="text"){
            filter_function=this._getTextFilterFunction(filter.operand,filter.value);
         }
         else if (filter.datatype==="boolean"){
             filter_function=this._getBooleanFilterFunction(filter.operand,filter.value);
         }
         else{
             filter_function=this._getNumberFilterFunction(filter.operand,filter.value);
         }
         return filter_function;
    }
    


    _getDimension(field){
        return this.filter_panel.ndx.dimension(function(d){
            return d[field];
        });
    }

    _getTextFilterFunction(operand,value){
        return function(d){
             if (d===null){
                 return false;
             }
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


    _getBooleanFilterFunction(operand,value){
        return function(d){
            return d===value;
        }
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


 /**
* Creates a dialog that enables users to select fields with which to sort
* @param {object[]} all_columns - A list of column objects which should have field, name and datatype
* @param {object[]} sort_column - columns that are already being used to sort . A list with sortAsc and column object
* e.g. [{sortAsc:true,column:{field:"age",name:"age",datatype:"integer"}}]
* @param {function} callback - The function called after the user chhoses the columns 
* It should accept list containing the sort columns (see above)
*/
class MLVSortDialog{
    constructor(all_columns,sort_columns,callback){
       this.div = $("<div>").attr("class", "mlv-sort-dialog");
       this.all_columns = all_columns;
       this.sort_columns=sort_columns;
       this.field_to_col={}
       for (let c of this.all_columns){
            this.field_to_col[c.field]=c;
       }
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
            width:300,
            close: ()=>{
                this.div.dialog("destroy").remove();
            }
        }).dialogFix();
        this._init();
    }
    _init(){
        let self= this;
        this.div.append($("<label>").text("Columns:"));
        this.list =$("<div>").css({"padding":"4px","margin":"4px"}).appendTo(this.div);
        this.list.sortable();
        this.column_select=$("<select>").appendTo(this.div);
        for (let column of this.all_columns){
           this.column_select.append($('<option>', {
	           value: column.field,
	           text: column.name
	       }));   
        }

        for (let rec of this.sort_columns){
            this._addSortRecord(rec)
        }

        let add_but = $("<i>").attr("class","fas fa-plus").click(function(e){
            let field= self.column_select.val();
            let col = self.field_to_col[field];
            self._addSortRecord({sortCol:col,sortAsc:true});
            self.div.css("height","100%");
        }).appendTo(this.div);
       
    }
    _sort(){
       let sort_cols=[];
       let ret_sort_cols=[];
       let self = this;
       this.list.children().each(function(e){
           let field=$(this).data("field");
           let col= self.field_to_col[field];
           let order=$(this).data("order");
           sort_cols.push({sortAsc:order==="ASC",sortCol:col});
         
       })
       return sort_cols;
    }

    _addSortRecord(rec){
          let col = rec.sortCol;
          let li = $("<div>").css({"margin-top":"6px","margin-bottom":"6spx"}).data("field",col.field);
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
              let field =p.data("field");
              let c =self.field_to_col[field];

              self.column_select.append($('<option>', {
	               value: field,
	               text: c.name
	            }));   
             p.remove();
             self.div.css("height","100%");
          }).css({float:"right"}).appendTo(li);


          li.append(move_handle).append(text).append(select).appendTo(this.list);
          this.column_select.children().each(function(){
              let item=$(this);
              if (item.val()===rec.sortCol.field){
                  item.remove();
              }
          })
    }
}



class MLVFilterDialog{
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
        let height= only_field?120:500
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
            height:height,
             position: { my: "center", at: "top" },
            close: ()=>{
                this.div.dialog("destroy").remove();
                //this.callback();
            }
        }).dialogFix();

     
      
       this._addFilters(this.data_view.filters);
       let m = Math.max(this.list1.children().length,this.list2.children().length)*80
       m=(m>500)?500:m;
       this.div.height(m);
       this.div.resizeDialog();
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
                
                let poss= this.data_view.groupAndOrder(filter.field)
              
                value.autocomplete({
                    source:poss,
                    minLength:3,
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
        let min_max= this.data_view.getMinMax(filter.field)
        let min = min_max[0]
        let max =min_max[1];
        let range = max-min;
        let self=this;
        let s_max = range<5?max:Math.ceil(max);
        let s_min =range<5?min:Math.floor(min);

        let filter_values=filter.value;
        if (!filter_values){
            filter_values=[min,max]
        }
        else{
            if (filter.operand===">"){
                filter_values=[filter.value,max]
            }
            else if (filter.operand==="<"){
                filter_values=[min,filter,value]
            }
            else if (filter.operand==="="){
                filter_values=[filter.value,filter.value]
            }
        }
        let slider=  $("<div>").attr("class","mlv-filter-slider").slider({
              range: true,
               min: s_min,
               max: s_max,
               values: [filter_values[0],filter_values[1]],
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
                
          }).width(60).val(filter_values[0]);

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
                
          }).width(60).val(filter_values[1]);


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





export {MLVTable,MLVDataView,FilterPanelDataView,ContextMenu,MLVSortDialog,MLVDownloadDialog,MLVFilterDialog};