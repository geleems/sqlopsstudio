/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import * as sqlops from 'sqlops';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';
import { IJobManagementService } from '../common/interfaces';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { JobsViewComponent } from '../views/jobsView.component';
import { AlertsViewComponent } from 'sql/parts/jobManagement/views/alertsView.component';
import { OperatorsViewComponent } from 'sql/parts/jobManagement/views/operatorsView.component';
import { ProxiesViewComponent } from 'sql/parts/jobManagement/views/proxiesView.component';

export enum JobActions {
	Run = 'run',
	Stop = 'stop'
}

export interface IJobActionInfo {
	ownerUri: string;
	targetObject: any;
}

// Job actions

export class JobsRefreshAction extends Action {
	public static ID = 'jobaction.refresh';
	public static LABEL = nls.localize('jobaction.refresh', "Refresh");

	constructor(
	) {
		super(JobsRefreshAction.ID, JobsRefreshAction.LABEL, 'refreshIcon');
	}

	public run(context: JobsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			if (context) {
				context.refreshJobs();
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class NewJobAction extends Action {
	public static ID = 'jobaction.newJob';
	public static LABEL = nls.localize('jobaction.newJob', "New Job");

	constructor(
	) {
		super(NewJobAction.ID, NewJobAction.LABEL, 'newStepIcon');
	}

	public run(context: JobsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateJobDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class RunJobAction extends Action {
	public static ID = 'jobaction.runJob';
	public static LABEL = nls.localize('jobaction.run', "Run");

	constructor(
		@INotificationService private notificationService: INotificationService,
		@IJobManagementService private jobManagementService: IJobManagementService
	) {
		super(RunJobAction.ID, RunJobAction.LABEL, 'runJobIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let jobName = context.agentJobInfo.name;
		let ownerUri = context.ownerUri;
		return new TPromise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Run).then(result => {
				if (result.success) {
					var startMsg = nls.localize('jobSuccessfullyStarted', ': The job was successfully started.');
					this.notificationService.notify({
						severity: Severity.Info,
						message: jobName+ startMsg
					});
					resolve(true);
				} else {
					this.notificationService.notify({
						severity: Severity.Error,
						message: result.errorMessage
					});
					resolve(false);
				}
			});
		});
	}
}

export class StopJobAction extends Action {
	public static ID = 'jobaction.stopJob';
	public static LABEL = nls.localize('jobaction.stop', "Stop");

	constructor(
		@INotificationService private notificationService: INotificationService,
		@IJobManagementService private jobManagementService: IJobManagementService
	) {
		super(StopJobAction.ID, StopJobAction.LABEL, 'stopJobIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let jobName = context.agentJobInfo.name;
		let ownerUri = context.ownerUri;
		return new TPromise<boolean>((resolve, reject) => {
			this.jobManagementService.jobAction(ownerUri, jobName, JobActions.Stop).then(result => {
				if (result.success) {
						var stopMsg = nls.localize('jobSuccessfullyStopped', ': The job was successfully stopped.');
						this.notificationService.notify({
							severity: Severity.Info,
							message: jobName+ stopMsg
						});
					resolve(true);
				} else {
					this.notificationService.notify({
						severity: Severity.Error,
						message: result.errorMessage
					});
					resolve(false);
				}
			});
		});
	}
}

export class EditJobAction extends Action {
	public static ID = 'jobaction.editJob';
	public static LABEL = nls.localize('jobaction.editJob', "Edit Job");

	constructor() {
		super(EditJobAction.ID, EditJobAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteJobAction extends Action {
	public static ID = 'jobaction.deleteJob';
	public static LABEL = nls.localize('jobaction.deleteJob', "Delete Job");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IJobManagementService private _jobService: IJobManagementService
	) {
		super(DeleteJobAction.ID, DeleteJobAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let job = actionInfo.targetObject as sqlops.AgentJobInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteJobConfirm,', "Are you sure you'd like to delete the job '{0}'?", job.name),
			[{
				label: DeleteJobAction.LABEL,
				run: () => {
					self._jobService.deleteJob(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteJob", "Could not delete job '{0}'.\nError: {1}",
								job.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._notificationService.error(errorMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return TPromise.as(true);
	}
}

// Step Actions

export class NewStepAction extends Action {
	public static ID = 'jobaction.newStep';
	public static LABEL = nls.localize('jobaction.newStep', "New Step");

	constructor(
		@ICommandService private _commandService: ICommandService
	) {
		super(NewStepAction.ID, NewStepAction.LABEL, 'newStepIcon');
	}

	public run(context: JobHistoryComponent): TPromise<boolean> {
		let ownerUri = context.ownerUri;
		let jobName = context.agentJobInfo.name;
		let server = context.serverName;
		let stepId = 0;
		if (context.agentJobHistoryInfo && context.agentJobHistoryInfo.steps) {
			stepId = context.agentJobHistoryInfo.steps.length + 1;
		}
		return new TPromise<boolean>((resolve, reject) => {
			resolve(this._commandService.executeCommand('agent.openNewStepDialog', ownerUri, jobName, server, stepId));
		});
	}
}

// Alert Actions

export class NewAlertAction extends Action {
	public static ID = 'jobaction.newAlert';
	public static LABEL = nls.localize('jobaction.newAlert', "New Alert");

	constructor(
	) {
		super(NewAlertAction.ID, NewAlertAction.LABEL, 'newStepIcon');
	}

	public run(context: AlertsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateAlertDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class EditAlertAction extends Action {
	public static ID = 'jobaction.editAlert';
	public static LABEL = nls.localize('jobaction.editAlert', "Edit Alert");

	constructor() {
		super(EditAlertAction.ID, EditAlertAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteAlertAction extends Action {
	public static ID = 'jobaction.deleteAlert';
	public static LABEL = nls.localize('jobaction.deleteAlert', "Delete Alert");
	public static CancelLabel = nls.localize('jobaction.Cancel', "Cancel");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IJobManagementService private _jobService: IJobManagementService
	) {
		super(DeleteAlertAction.ID, DeleteAlertAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let alert = actionInfo.targetObject as sqlops.AgentAlertInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteAlertConfirm,', "Are you sure you'd like to delete the alert '{0}'?", alert.name),
			[{
				label: DeleteAlertAction.LABEL,
				run: () => {
					self._jobService.deleteAlert(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteAlert", "Could not delete alert '{0}'.\nError: {1}",
								alert.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._notificationService.error(errorMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return TPromise.as(true);
	}
}

// Operator Actions

export class NewOperatorAction extends Action {
	public static ID = 'jobaction.newOperator';
	public static LABEL = nls.localize('jobaction.newOperator', "New Operator");

	constructor(
	) {
		super(NewOperatorAction.ID, NewOperatorAction.LABEL, 'newStepIcon');
	}

	public run(context: OperatorsViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateOperatorDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class EditOperatorAction extends Action {
	public static ID = 'jobaction.editAlert';
	public static LABEL = nls.localize('jobaction.editOperator', "Edit Operator");

	constructor() {
		super(EditOperatorAction.ID, EditOperatorAction.LABEL);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteOperatorAction extends Action {
	public static ID = 'jobaction.deleteOperator';
	public static LABEL = nls.localize('jobaction.deleteOperator', "Delete Operator");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IJobManagementService private _jobService: IJobManagementService
	) {
		super(DeleteOperatorAction.ID, DeleteOperatorAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let operator = actionInfo.targetObject as sqlops.AgentOperatorInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteOperatorConfirm,', "Are you sure you'd like to delete the operator '{0}'?", operator.name),
			[{
				label: DeleteOperatorAction.LABEL,
				run: () => {
					self._jobService.deleteOperator(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteOperator", "Could not delete operator '{0}'.\nError: {1}",
								operator.name, result.errorMessage ? result.errorMessage : 'Unknown error');
							self._notificationService.error(errorMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return TPromise.as(true);
	}
}


// Proxy Actions

export class NewProxyAction extends Action {
	public static ID = 'jobaction.newProxy';
	public static LABEL = nls.localize('jobaction.newProxy', "New Proxy");

	constructor(
	) {
		super(NewProxyAction.ID, NewProxyAction.LABEL, 'newStepIcon');
	}

	public run(context: ProxiesViewComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.openCreateProxyDialog();
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class EditProxyAction extends Action {
	public static ID = 'jobaction.editProxy';
	public static LABEL = nls.localize('jobaction.editProxy', "Edit Proxy");

	constructor() {
		super(EditProxyAction.ID, EditProxyAction.LABEL);
	}

	public run(info: any): TPromise<boolean> {
		return TPromise.as(true);
	}
}

export class DeleteProxyAction extends Action {
	public static ID = 'jobaction.deleteProxy';
	public static LABEL = nls.localize('jobaction.deleteProxy', "Delete Proxy");

	constructor(
		@INotificationService private _notificationService: INotificationService,
		@IJobManagementService private _jobService: IJobManagementService
	) {
		super(DeleteProxyAction.ID, DeleteProxyAction.LABEL);
	}

	public run(actionInfo: IJobActionInfo): TPromise<boolean> {
		let self = this;
		let proxy = actionInfo.targetObject as sqlops.AgentProxyInfo;
		self._notificationService.prompt(
			Severity.Info,
			nls.localize('jobaction.deleteProxyConfirm,', "Are you sure you'd like to delete the proxy '{0}'?", proxy.accountName),
			[{
				label: DeleteProxyAction.LABEL,
				run: () => {
					self._jobService.deleteProxy(actionInfo.ownerUri, actionInfo.targetObject).then(result => {
						if (!result || !result.success) {
							let errorMessage = nls.localize("jobaction.failedToDeleteProxy", "Could not delete proxy '{0}'.\nError: {1}",
								proxy.accountName, result.errorMessage ? result.errorMessage : 'Unknown error');
								self._notificationService.error(errorMessage);
						}
					});
				}
			}, {
				label: DeleteAlertAction.CancelLabel,
				run: () => { }
			}]
		);
		return TPromise.as(true);
	}
}