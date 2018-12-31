import {pako} from "./vendor/pako_inflate.js";


class MLVFileChooser{
    constructor(callback,filter){
        this.fileInput = $("<input>").attr("type","file").hide();
        this.callback=callback;
        if (filter){
            this.fileInput.attr("accept",filter);
        }
        $('<body>').append(this.fileInput);
        this.fileInput.change((event)=>{
            let f = new MLVFile(event.target.files[0]);
            f.readHeader(this.callback);
          
        });
    }
    
    setFilter(filter){
        this.fileInput.attr("accept", filter);
    }
    
    showOpenDialog(callback){
        if (callback){
            this.callback=callback;
        }
        this.fileInput.trigger("click");
    }
    destroy(){
        this.file_input.remove();
    }
}

function mlvUploadFile(file,url,data,callback){
    let xhr = new XMLHttpRequest();
    let fd = new FormData();
    xhr.responseType="json";
    xhr.open("POST", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
            // Every thing ok, file uploaded
            callback(xhr.response);
        }
    };
    fd.append("upload_file", file);
    fd.append("data",JSON.stringify(data));
    xhr.send(fd);   
}


class MLVFile{
    constructor(file){
        this.file=file;
        this.is_gz=file.name.endsWith(".gz");
        this.delimiter="\t";
        this.errors=[];
        this.comment_symbol="#";
    }
    readHeader(callback){
        let blob = this.file.slice(0,1500);
        let reader = new FileReader();
        reader.onloadend= (evt)=>{
            if (evt.target.readyState == FileReader.DONE){
                try{
                    let header = evt.target.result;
                    if (this.is_gz){
                        header = pako.inflate(evt.target.result,{to:"string"})
                    }
                    let lines =header.split(/\r?\n/);
                    this.getHeaders(lines);
               
                }catch(e){
                    console.log(e);
                    this.errors.push("Unable to read file");
                }
                callback(this);         
            }
        };
        reader.readAsBinaryString(blob) 
    }

    getHeaders(lines,callback){
        let header_line=0;
        for (let line of lines){
            if (line.startsWith(this.comment_symbol) || !line){
                header_line++;
            }
            else{
                break;
            }
        }
        let headers =lines[header_line].replace('"',"")
        let arr1=headers.split("\t");
        let arr2=headers.split(",");
        this.delimiter=",";
        headers=arr2;
        if (arr1.length>arr2.length){
            this.delimiter="\t";
            headers=arr1;
        }
        let types=[];
        let values = lines[header_line+1].split(this.delimiter);
        if (headers.length !== values.length){
            this.errors.push("Rows contains unequal numbers of columns");
            return;
        }

        for (let val of values){
            if (isNaN(val)){
                types.push("text");
            }
            else if(val.includes(".")){
                types.push("double");
            }
            else{
                types.push("integer");
            }
        }
        this.fields= [];
        let count=0;
        for (let val of headers){
            this.fields.push({"name":val,"type":types[count],"position":count});
            count++;
        }
        this.first_line_values=values;
    }
 
}

class MLVFileUploadDialog{
    constructor(config){
        if (!config){
            config={};
        }
        this.config=config;
        this.div = $("<div>").dialog().dialogFix();
        this.file_chooser= new MLVFileChooser(function(file){
            self.displayFileInfo(file)
        })
        let but  = $("<button>").text("ChooseFile").click(function(e){
            self.file_chooser.showOpenDialog();
        }).appendTo(this.div);
        this.name_div = $("<div>").appendTo(this.div);
        let self = this;
        this.fields_div=$("<div>").appendTo(this.div);
        this.has_header_check= $("<input>").attr({"type":"checkbox","checked":false}).click(function(e){
            self._changeHeaders();
        }).appendTo(this.div);
        this.div.append("<span>Has Headers</span>");
        this.fields_div=$("<div>").appendTo(this.div);
        this.upload_but = $("<button>").text("Upload").attr("disabled",true).click(function(e){
            self._uploadFile();
        }).appendTo(this.div);
        this.has_headers=false;

    }

    _changeHeaders(){
        this.has_headers= this.has_header_check.prop("checked");
        let self = this;
        
        this.div.find(".field-name-input").each(function(i){
                let field = $(this).data("field");
                let pos = $(this).data("position");
                if (self.config.compulsory_fields && self.config.compulsory_fields[pos]){
                     $(this).val(field.name);
                     $(this).attr("disable",true);
                }
                else if (!self.has_headers){
                    $(this).val("Enter Column Name ("+field.name+")")
                }
                else{
                   $(this).val(field.name);
                }
        });
        
    }

    setUploadCallback(upload_callback){
        this.upload_callback=upload_callback;
    }

    _addHeader(field,n){
            let div = $("<div>").attr("class","field-div");
            let span = $("<span>").text(n+".").width(20).css("display","inline-block");
            div.append(span);
            let name = this.has_headers?field.name:"Enter Column Name ("+field.name+")";
            if (this.config.compulsory_fields && this.config.compulsory_fields[n]){
                name=field.name;
            }
                        let select = $("<select><option>text</option><option>integer</option><option>double</option></select>");
            select.val(field.type);
            let input = $("<input>").css({"display":"inline","width":"50%"}).attr("class","field-name-input").val(name).data({"position":n,"field":field,"select":select});
            div.append(input);
          

            div.append(select);
              if (this.config.compulsory_fields && this.config.compulsory_fields[n]){
                input.attr("disabled",true);
                select.attr("disabled",true);
            }
            this.fields_div.append(div);
            if (!this.config.compulsory_fields || (!this.config.compulsory_fields[n])){
                let delete_but=$("<i class='fa fa-trash'></i>").data("div",div).click(function(e){
                    let index = $(this).data("index");
                    $(this).data("div").remove();
                });
                div.append(delete_but);
            }
          

    }

    _uploadFile(){
        if (this.upload_callback){
            this.upload_callback(this.file,this.getFields());
        }
    }

    getFields(){
        let fields = [];
        this.div.find(".field-name-input").each(function(i){
            let el =$(this);
            let name = el.val()
            let pos = el.data("position");
            let datatype = el.data("select").val();
            fields.push({name:name,position:pos,datatype:datatype});
        });
        return fields;
    }

    displayFileInfo(file){
        this.file=file.file;
        this.fields_div.empty();
        let error_message="";
        if (this.config.compulsory_fields){
            let c = this.config.compulsory_fields;
            let index = 1;
            for (let field of file.fields){
                let c_field= c[index];
                if (!c_field){
                }
                else{
                    field.name=c_field.label;
                    if (field.type !== c_field.datatype){
                        break;
                    }
                }
                console.log(c_field);
                index++;
            }
        }
        this.headers=file.fields;
        this.name_div.text(file.file.name);
        let index=1;
        for (let field of file.fields){
            this._addHeader(field,index);
            index++;
        }
        this.upload_but.attr("disabled",false);
    }
}

export {MLVFileChooser,MLVFileUploadDialog,mlvUploadFile};
