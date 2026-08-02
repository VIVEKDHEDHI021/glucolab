package com.glucolab.app.widgets;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.widget.Button;
import android.widget.TextView;
import com.glucolab.app.R;

public class QuickInsulinConfirmActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_quick_insulin_confirm);

        Intent intent = getIntent();
        final int units = intent != null ? intent.getIntExtra(QuickInsulinReceiver.EXTRA_UNITS, 0) : 0;

        TextView messageTv = findViewById(R.id.tv_dialog_message);
        if (messageTv != null) {
            messageTv.setText("Log " + units + " Units of Insulin?");
        }

        Button cancelBtn = findViewById(R.id.btn_dialog_cancel);
        if (cancelBtn != null) {
            cancelBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    finish();
                }
            });
        }

        Button confirmBtn = findViewById(R.id.btn_dialog_confirm);
        if (confirmBtn != null) {
            confirmBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (units > 0) {
                        QuickInsulinReceiver.performInsulinSave(QuickInsulinConfirmActivity.this, units);
                    }
                    finish();
                }
            });
        }
    }
}
