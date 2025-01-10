import { Component, Input, OnInit, Output, EventEmitter, OnDestroy } from '@angular/core';
import { FrameworkService } from '../../services/framework.service';
import { MatDialog } from '@angular/material/dialog';
import { CreateTermComponent } from '../create-term/create-term.component';
import { IConnectionType } from '../../models/connection-type.model';
import { Subscription } from 'rxjs';
import { ConnectorService } from '../../services/connector.service';
import { ApprovalService } from '../../services/approval.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { defaultConfig, headerLineConfig } from '../../constants/app-constant';
import { labels } from '../../labels/strings';
import { Card } from '../../models/variable-type.model';

declare var LeaderLine: any;
@Component({
  selector: 'lib-taxonomy-view',
  templateUrl: './taxonomy-view.component.html',
  styleUrls: ['./taxonomy-view.component.scss']
})
export class TaxonomyViewComponent implements OnInit, OnDestroy {
  @Input() approvalList: Array<Card> = [];
  @Input() isApprovalView: boolean = false;
  @Input() workFlowStatus: string;
  @Input() environment:any;
  @Input() taxonomyConfig: any;

  @Output() sentForApprove = new EventEmitter<any>()
  mapping = {};
  heightLighted = []
  localList = []
  showPublish: boolean = false
  newTermSubscription: Subscription = null
  loaded: any = {}
  showActionBar: boolean = false
  approvalRequiredTerms = []
  draftTerms: Array<Card> = [];
  isLoading: boolean = false;
  categoryList:any = [];
  app_strings: any = labels;
  constructor(private frameworkService: FrameworkService,
    public dialog: MatDialog, 
    private approvalService: ApprovalService,
    private router: Router,
    private _snackBar: MatSnackBar,
    private connectorSvc: ConnectorService) { }

  ngOnInit() {
    this.init()
    this.showActionBar = this.isApprovalView?true:false;
  }

  ngOnChanges() {
    this.draftTerms = this.approvalList;
  }

  init() {
    this.initConfig();
    this.frameworkService.getFrameworkInfo().subscribe(res => {
      this.connectorSvc.removeAllLines()
      this.frameworkService.categoriesHash.value.forEach((cat:any) => {
        this.loaded[cat.code] = true
      })
      this.isLoading = false
        setTimeout(() => {
             this.drawHeaderLine(res.result.framework.categories.length);  
        },500)
    })
  
  }

  updateTaxonomyTerm(data: { selectedTerm: any, isSelected: boolean }) {
    
    this.updateFinalList(data)
    this.updateSelection(data.selectedTerm.category, data.selectedTerm.code);
  }
  updateSelection(category: string, selectedTermCode: string) {
    this.frameworkService.list.get(category).children.map(item => {
      item.selected = selectedTermCode === item.code ? true : false
      return item
    })
  }

  //need to refactor at heigh level
  updateFinalList(data: { selectedTerm: any, isSelected: boolean, parentData?: any, colIndex?: any }) {
    if (data.isSelected) {
      // data.selectedTerm.selected = data.isSelected
      this.frameworkService.selectionList.set(data.selectedTerm.category, data.selectedTerm);
      const next = this.frameworkService.getNextCategory(data.selectedTerm.category)
      if (next && next.code) {
        this.frameworkService.selectionList.delete(next.code)
      }
      // notify next
      this.frameworkService.insertUpdateDeleteNotifier.next({ action: data.selectedTerm.category, type: 'select', data: data.selectedTerm })
    } 
    if(data.colIndex === 0 && !data.isSelected) {
      this.isLoading = true;
      setTimeout(()=> {
        this.init()
      },3000)
    }
    setTimeout(() => {
      this.loaded[data.selectedTerm.category] = true
    }, 100);
  }
  
  isEnabled(columnCode: string): boolean {
    return !!this.frameworkService.selectionList.get(columnCode)
  }
  openCreateTermDialog(column, colIndex) {  
    if (!this.isEnabled(column.code)) {
      const dialog = this.dialog.open(CreateTermComponent, {
        data: { columnInfo: column, frameworkId: this.frameworkService.getFrameworkId(), selectedparents: this.heightLighted, colIndex: colIndex },
        width: '400px',
        panelClass: 'custom-dialog-container'
      })
      dialog.afterClosed().subscribe(res => {
        if(!res) {
          return;
        }
        if (res && res.created) {
          this.showPublish = true
        }
        this.loaded[res.term.category] = false
        // wait
        const parentColumn = this.frameworkService.getPreviousCategory(res.term.category)
        res.parent = null
        if (parentColumn) {
          res.parent = this.frameworkService.selectionList.get(parentColumn.code)
          res.parent.children? res.parent.children.push(res.term) :res.parent['children'] = [res.term]
        }
        this.updateFinalList({ selectedTerm: res.term, isSelected: false, parentData: res.parent, colIndex:colIndex })
      })
    }
  }

  get list(): any[] {
    console.log("this.frameworkService.list ==>", this.frameworkService.list);
    return Array.from(this.frameworkService.list.values())
  }
  
  drawHeaderLine(len: number){
    const options = {...defaultConfig,...headerLineConfig }
    for(let i=1; i<=len; i++){
      const startEle = document.querySelector(`#box${i}count`)
      const endEle = document.querySelector(`#box${i}Header`)
      if(startEle && endEle) {
        new LeaderLine(startEle, endEle, options);
      }
    }
  }

  getColumn(columnCode: string) {
    return this.frameworkService.list.get(columnCode)
  }
  
  updateDraftStatusTerms(event){
    if(event.checked) {
      this.draftTerms.push(event.term)
      } else {
      this.draftTerms = this.draftTerms.filter(d => event.term.identifier !== d.identifier)
    }
    this.showActionBar = this.draftTerms.length>0?true:false
  }

  getNoOfCards(event:any) {
    if(this.categoryList.length > 0 && event.category !== '') {
      let index = this.categoryList.findIndex((obj:any) => obj.category == event.category);
      if(index > -1) {
        this.categoryList.splice(index);
      }
    }
    if(event.category == '') {
      this.categoryList[this.categoryList.length-1].count = 0;
    }
    this.categoryList.push(event);
  }
  


  sendForApproval(){
    if(!this.isApprovalView){
        let parentList = []
        this.list.forEach(ele => {
          const t = ele.children.filter(term => term.selected === true)
          if(t[0]){
            parentList.push(t[0])
          } 
        })
        const req = {
          updateFieldValues:[...parentList, ...this.draftTerms]
        }
        this.approvalService.createApproval(req).subscribe(res => {
          this.frameworkService.removeOldLine()
          this._snackBar.open('Terms successfully sent for Approval.', 'cancel')
        })
    } else {
      this.sentForApprove.emit(this.draftTerms)
      console.log(this.draftTerms)
    }
   
  }

  closeActionBar(e){ 
    this.showActionBar = false;
  }

  initConfig() {
    if(this.environment){
      this.frameworkService.updateEnvironment(this.environment);
      this.frameworkService.setConfig(this.taxonomyConfig);
    }
  }

  ngOnDestroy(){
      this.frameworkService.removeOldLine();
  }

  
}
